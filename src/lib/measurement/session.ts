import type { createAdminClient } from "@/lib/supabase/admin";
import { ACTIVE_ENGINES } from "@/lib/ai-engines/types";
import type { MeasurementTrigger } from "@/lib/admin/trial-policy";
import {
  CLASSIFIER_VERSION,
  METHODOLOGY_VERSION,
  SCORING_VERSION,
  currentCodeSha,
  hashPromptSet,
} from "./versions";

type Admin = ReturnType<typeof createAdminClient>;

// P0.2-B — Ciclo de vida de una Measurement Session.
//
// ===========================================================================
// POR QUE EXISTE ESTO
// ===========================================================================
// Hasta P0.2-B el score se calculaba con `where client_id = X` sobre TODO el historico.
// Eso se comprobo en produccion con aritmetica exacta: el mismo negocio, el mismo dia, con
// 17 minutos de diferencia, paso de 18.93 a 18.14 — porque el pool de runs crecio de 15 a
// 36, no porque el negocio cambiara. El score no medía al cliente: medía cuantas veces lo
// habiamos medido.
//
// Una sesion es el conjunto CERRADO del que se deriva un score. La palabra que hace el
// trabajo es "cerrado": la pertenencia se decide por session_id, no por rango de fechas.
// Un rango de fechas todavia podria capturar un run que entro por otra via (una prueba de
// admin, un competidor); `session_id = X` no puede.
// ===========================================================================

/** Decision del fundador. Ver sweepZombieSessions() para por que es imprescindible. */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export type ExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "partial"
  | "failed"
  | "cancelled";

export type PublicationStatus = "draft" | "published" | "withheld" | "superseded";

export interface OpenSessionInput {
  clientId: string;
  trigger: MeasurementTrigger;
  /** Textos de los prompts activos. Definen expected_runs y el prompt_set_hash. */
  promptTexts: string[];
}

export interface OpenSessionResult {
  sessionId: string;
  expectedRuns: number;
  promptSetHash: string;
}

/**
 * Marca como `failed` las sesiones abiertas que superaron SESSION_TIMEOUT_MS.
 *
 * NO es un detalle operativo: el indice parcial `one_open_per_client` impide una segunda
 * sesion abierta por cliente, asi que sin este barrido un timeout de serverless dejaria a
 * ese cliente SIN PODER MEDIRSE NUNCA MAS. El indice se convertiria en un candado.
 *
 * Se dispara por dos vias (§E del diseño):
 *   1. Perezosa — desde openSession(), para el cliente concreto. El candado se auto-cura
 *      sin depender de que el cron llegue a tiempo.
 *   2. Periodica — al inicio del cron M11, para todos.
 *
 * Los runs ya escritos NO se borran: son evidencia real de una medicion incompleta.
 * Una sesion `failed` no produce snapshot y no consume trial.
 */
export async function sweepZombieSessions(admin: Admin, clientId?: string): Promise<number> {
  const cutoff = new Date(Date.now() - SESSION_TIMEOUT_MS).toISOString();

  let query = admin
    .from("measurement_sessions")
    .update({
      execution_status: "failed",
      failure_reason: "timeout_zombie",
      completed_at: new Date().toISOString(),
    })
    .in("execution_status", ["pending", "running"])
    .lt("started_at", cutoff);

  if (clientId) query = query.eq("client_id", clientId);

  const { data, error } = await query.select("id");
  if (error) throw new Error(`No se pudo barrer sesiones zombi: ${error.message}`);
  return data?.length ?? 0;
}

/**
 * Abre una sesion. Devuelve null si el cliente ya tiene una sesion abierta VIVA — es decir,
 * si otro proceso esta midiendo ahora mismo.
 *
 * Ese null es la defensa contra doble click, cron duplicado y dos procesos concurrentes: no
 * se crea una segunda medicion, no se gasta credito de API dos veces, y el llamador decide
 * si esperar o abandonar. La garantia la da el indice unico parcial de Postgres, no esta
 * funcion — aqui solo se traduce el conflicto a un valor de retorno.
 */
export async function openSession(
  admin: Admin,
  input: OpenSessionInput,
): Promise<OpenSessionResult | null> {
  // Auto-curacion: si la sesion abierta que bloquea ya expiro, se cierra antes de intentar.
  await sweepZombieSessions(admin, input.clientId);

  const expectedRuns = input.promptTexts.length * ACTIVE_ENGINES.length;
  const promptSetHash = hashPromptSet(input.promptTexts);

  const { data, error } = await admin
    .from("measurement_sessions")
    .insert({
      client_id: input.clientId,
      trigger_source: input.trigger,
      execution_status: "running",
      publication_status: "draft",
      // FIJADO aqui, nunca derivado al leer: si prompt_sets cambia mientras la sesion corre,
      // la cobertura se sigue midiendo contra el denominador que se declaro al arrancar.
      expected_runs: expectedRuns,
      engine_set: [...ACTIVE_ENGINES],
      prompt_set_hash: promptSetHash,
      methodology_version: METHODOLOGY_VERSION,
      scoring_version: SCORING_VERSION,
      classifier_version: CLASSIFIER_VERSION,
      code_sha: currentCodeSha(),
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = unique_violation. Es el indice parcial: ya hay una sesion abierta viva.
    if (error.code === "23505") return null;
    throw new Error(`No se pudo abrir la sesion de medicion: ${error.message}`);
  }

  return { sessionId: data.id, expectedRuns, promptSetHash };
}

export interface CloseSessionResult {
  executionStatus: ExecutionStatus;
  coverageExpected: number;
  coverageSuccessful: number;
}

/**
 * Cierra la sesion calculando su cobertura real.
 *
 * La cobertura se mide contra los runs CANONICOS: un intento fallido, un timeout o un
 * rate-limit no producen canonico, asi que bajan la cobertura sin ensuciar el score. Es la
 * aplicacion temporal de ERROR != ABSENT.
 *
 * `skipped` NO cuenta en el denominador: un motor deliberadamente no llamado (sin API key)
 * es alcance reducido y declarado, no cobertura perdida — penalizar al cliente por una
 * decision nuestra seria incorrecto.
 */
export async function closeSession(admin: Admin, sessionId: string): Promise<CloseSessionResult> {
  const [{ data: session, error: sessionError }, { count: canonicalCount, error: runsError }, { count: skippedCount }] =
    await Promise.all([
      admin.from("measurement_sessions").select("expected_runs").eq("id", sessionId).single(),
      admin
        .from("tracking_runs")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .eq("is_canonical", true),
      admin
        .from("tracking_runs")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .eq("outcome", "skipped"),
    ]);

  if (sessionError || !session) {
    throw new Error(`No se encontro la sesion ${sessionId}: ${sessionError?.message ?? "not found"}`);
  }
  if (runsError) throw new Error(`No se pudieron contar los runs de ${sessionId}: ${runsError.message}`);

  const successful = canonicalCount ?? 0;
  // Los skipped salen del denominador (alcance declarado, no fallo).
  const expected = Math.max(0, session.expected_runs - (skippedCount ?? 0));

  const executionStatus: ExecutionStatus =
    successful === 0 ? "failed" : successful >= expected ? "completed" : "partial";

  const { error: updateError } = await admin
    .from("measurement_sessions")
    .update({
      execution_status: executionStatus,
      completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (updateError) throw new Error(`No se pudo cerrar la sesion ${sessionId}: ${updateError.message}`);

  return { executionStatus, coverageExpected: expected, coverageSuccessful: successful };
}
