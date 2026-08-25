import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

// P0.2-B — Reintento de celdas incompletas dentro de una sesion.
//
// ===========================================================================
// EL PROBLEMA QUE RESUELVE
// ===========================================================================
// Una auditoria gratis son 5 preguntas x 3 motores = 15 runs esperados. closeSession solo
// marca `completed` si estan los 15, y solo una sesion `completed` publica snapshot. Con eso,
// UN SOLO 429 de un motor dejaba la sesion en `partial`, sin snapshot, y el prospecto veia un
// 404 en su reporte. Los fallos de motor no son raros: rompia el funnel principal.
//
// La salida NO es bajar el umbral de publicacion —eso cambiaria la politica de veracidad—
// sino conseguir de verdad los datos que faltan. Aqui se reintentan solo las celdas que
// fallaron por causas transitorias, apoyandose en la idempotencia que ya existe: el indice
// unico parcial garantiza que un reintento exitoso produce UN unico canonico.
// ===========================================================================

/** Intentos totales por celda: el original + 2 reintentos. */
export const MAX_ATTEMPTS_PER_CELL = 3;

/** Espera entre pasadas. Existe sobre todo por los 429: reintentar al instante los repite. */
const RETRY_DELAY_MS = 1_500;

/** Outcomes que SI justifican reintentar: todos transitorios o de bug propio. */
const RETRYABLE_OUTCOMES = new Set(["failed", "timeout", "rate_limited", "invalid_response"]);

export interface CellState {
  engine: string;
  /** Ya hay un resultado bueno para esta celda. */
  hasCanonical: boolean;
  /** Outcome del ultimo intento, o null si nunca se intento. */
  lastOutcome: string | null;
  /** Cuantas veces se intento esta celda en esta sesion. */
  attempts: number;
}

/**
 * Decide si una celda (prompt x motor) merece otro intento. Pura y determinista a proposito:
 * es la regla de negocio del reintento y se puede testear sin base de datos ni motores.
 *
 * NO se reintenta:
 *   - `hasCanonical` — ya hay un exito; repetirlo gastaria API y no cambiaria nada.
 *   - `skipped` — el motor no tiene credencial. Volver a llamarlo daria `skipped` otra vez:
 *     es alcance declarado, no un fallo transitorio.
 *   - celdas que agotaron MAX_ATTEMPTS_PER_CELL — un fallo persistente deja la sesion
 *     incompleta, y eso es informacion honesta, no algo que haya que forzar.
 */
export function shouldRetryCell(cell: CellState, maxAttempts = MAX_ATTEMPTS_PER_CELL): boolean {
  if (cell.hasCanonical) return false;
  if (cell.attempts >= maxAttempts) return false;
  if (cell.lastOutcome === null) return true; // nunca se intento
  return RETRYABLE_OUTCOMES.has(cell.lastOutcome);
}

/** Celdas de una sesion que siguen sin resultado utilizable y pueden reintentarse. */
export function cellsNeedingRetry(cells: CellState[], maxAttempts = MAX_ATTEMPTS_PER_CELL): string[] {
  return cells.filter((c) => shouldRetryCell(c, maxAttempts)).map((c) => c.engine);
}

interface RunRow {
  prompt_id: string | null;
  engine: string;
  outcome: string;
  is_canonical: boolean;
  attempt: number;
}

/** Colapsa los runs de una sesion en el estado por celda (prompt x motor). */
export function buildCellStates(runs: RunRow[]): Map<string, CellState[]> {
  const byPrompt = new Map<string, Map<string, CellState>>();

  for (const run of runs) {
    const promptId = run.prompt_id ?? "__sin_prompt__";
    if (!byPrompt.has(promptId)) byPrompt.set(promptId, new Map());
    const cells = byPrompt.get(promptId)!;

    const existing = cells.get(run.engine) ?? {
      engine: run.engine,
      hasCanonical: false,
      lastOutcome: null,
      attempts: 0,
    };

    existing.hasCanonical = existing.hasCanonical || run.is_canonical;
    existing.attempts = Math.max(existing.attempts, run.attempt);
    // El outcome relevante es el del intento MAS ALTO, no el primero que llegue.
    if (run.attempt >= existing.attempts) existing.lastOutcome = run.outcome;

    cells.set(run.engine, existing);
  }

  const result = new Map<string, CellState[]>();
  for (const [promptId, cells] of byPrompt) result.set(promptId, [...cells.values()]);
  return result;
}

export interface RetryResult {
  passes: number;
  promptsRetried: number;
  cellsStillMissing: number;
}

/**
 * Reintenta las celdas incompletas de una sesion, hasta agotar los reintentos.
 *
 * DEBE llamarse ANTES de closeSession(): la cobertura se calcula al cerrar, asi que un
 * reintento posterior no contaria.
 *
 * No decide nada sobre publicacion. Si tras los reintentos siguen faltando resultados, la
 * sesion queda `partial` o `failed` segun la logica de siempre y NO se publica snapshot.
 * Este modulo consigue datos; no relaja ningun criterio.
 *
 * `runPrompt` se inyecta para no acoplar este modulo al motor de medicion (y para poder
 * testear la orquestacion sin llamar a APIs de pago).
 */
export async function retryIncompleteRuns(
  admin: Admin,
  sessionId: string,
  promptIds: string[],
  runPrompt: (promptId: string, sessionId: string) => Promise<unknown>,
  maxAttempts = MAX_ATTEMPTS_PER_CELL,
): Promise<RetryResult> {
  let passes = 0;
  let promptsRetried = 0;

  // maxAttempts intentos totales = 1 original + (maxAttempts - 1) pasadas de reintento.
  for (let pass = 0; pass < maxAttempts - 1; pass += 1) {
    const { data: runs, error } = await admin
      .from("tracking_runs")
      .select("prompt_id, engine, outcome, is_canonical, attempt")
      .eq("session_id", sessionId);

    if (error) throw new Error(`No se pudieron leer los runs de ${sessionId}: ${error.message}`);

    const states = buildCellStates(runs ?? []);
    const needing = promptIds.filter((id) => cellsNeedingRetry(states.get(id) ?? [], maxAttempts).length > 0);

    if (needing.length === 0) break;

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

    passes += 1;
    promptsRetried += needing.length;
    // runMeasurementForPromptSet ya es idempotente: reintenta solo las celdas sin canonico y
    // no vuelve a llamar a un motor que ya respondio bien.
    await Promise.allSettled(needing.map((id) => runPrompt(id, sessionId)));
  }

  const { data: finalRuns } = await admin
    .from("tracking_runs")
    .select("prompt_id, engine, outcome, is_canonical, attempt")
    .eq("session_id", sessionId);

  const finalStates = buildCellStates(finalRuns ?? []);
  let cellsStillMissing = 0;
  for (const id of promptIds) {
    const cells = finalStates.get(id) ?? [];
    cellsStillMissing += cells.filter((c) => !c.hasCanonical && c.lastOutcome !== "skipped").length;
  }

  return { passes, promptsRetried, cellsStillMissing };
}
