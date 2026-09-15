import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { runOpenAI } from "./openai";
import { runAnthropic } from "./anthropic";
import { runGemini } from "./gemini";
import { runPerplexity } from "./perplexity";
import { classifyMention } from "./classify";
import { extractDomain, isClientDomain, isDirectoryDomain } from "./classify-domain";
import { ACTIVE_ENGINES, isSkipped, type ActiveEngine, type EngineOutcome } from "./types";
import { loadClientIdentity } from "@/lib/identity/load-identity";
import { classifyPrompt } from "@/lib/prompt-class/classify-prompt";
import { CLASSIFIER_VERSION, hashPromptText, hashRequestConfig } from "@/lib/measurement/versions";
import { buildCellStates, shouldRetryCell, type CellState } from "@/lib/measurement/retry";

/** Estados posibles de un intento. ERROR != ABSENT: solo `success` produce canonico. */
export type RunOutcome =
  | "success"
  | "failed"
  | "timeout"
  | "rate_limited"
  | "invalid_response"
  | "skipped";

export interface MeasurementSummary {
  promptSetId: string;
  promptText: string;
  results: Array<
    | { engine: string; status: "inserted"; trackingRunId: string; mentioned: boolean; citations: number }
    | { engine: string; status: "already_measured" }
    | { engine: string; status: "skipped"; reason: string }
    | { engine: string; status: "error"; outcome: RunOutcome; message: string }
  >;
}

// M2 — corre un prompt_set contra los motores ACTIVOS del pilar 8 (OpenAI, Anthropic,
// Gemini, Perplexity) y persiste tracking_runs + citations.
//
// P0.1 — cada run guarda `prompt_class` y `mention_method`: sin eso la compuerta de TAO no
// puede distinguir una medicion limpia de una contaminada.
//
// P0.2-B — cada run pertenece ahora a una SESION y guarda todo lo necesario para
// reconstruir por que dio lo que dio: el prompt literal ejecutado, el modelo que realmente
// respondio, la configuracion del request y la version del clasificador. Ademas:
//
//   - Un fallo se PERSISTE como fallo (outcome real, sin canonico) en vez de desaparecer.
//     Antes un timeout simplemente achicaba el denominador y nadie se enteraba.
//   - Es IDEMPOTENTE: si ya existe un canonico para (sesion, prompt, motor) no vuelve a
//     llamar al motor. Eso hace la sesion reanudable y no gasta credito dos veces.
export async function runMeasurementForPromptSet(
  promptSetId: string,
  sessionId: string,
): Promise<MeasurementSummary> {
  const admin = createAdminClient();

  const { data: prompt, error: promptError } = await admin
    .from("prompt_sets")
    .select("id, prompt_text, client_id, prompt_class")
    .eq("id", promptSetId)
    .single();

  if (promptError || !prompt) {
    throw new Error(`No se encontro el prompt_set ${promptSetId}: ${promptError?.message ?? "not found"}`);
  }
  if (!prompt.client_id) {
    throw new Error(`prompt_set ${promptSetId} no tiene client_id`);
  }

  const [{ data: client }, { data: locations }, { data: skuCatalogs }] = await Promise.all([
    admin.from("clients").select("id, business_name, niche").eq("id", prompt.client_id).single(),
    admin.from("locations").select("website_url").eq("client_id", prompt.client_id),
    admin.from("sku_catalogs").select("store_url").eq("client_id", prompt.client_id),
  ]);

  if (!client) {
    throw new Error(`No se encontro el cliente ${prompt.client_id}`);
  }

  const { data: directorySources } = await admin
    .from("directory_sources")
    .select("directory_url_pattern")
    .eq("niche", client.niche);

  const clientDomains = [
    ...(locations ?? []).map((l) => l.website_url),
    ...(skuCatalogs ?? []).map((s) => s.store_url),
  ]
    .filter((u): u is string => Boolean(u))
    .map(extractDomain)
    .filter((d): d is string => Boolean(d));

  // P0.1 — Clase de contaminacion, decidida de forma DETERMINISTA antes de medir y guardada
  // como snapshot en cada run: si mañana alguien edita la pregunta o el nombre del negocio,
  // la evidencia de que ESTA medicion vino de un prompt limpio no cambia retroactivamente.
  const identity = await loadClientIdentity(admin, prompt.client_id);
  const classification = identity ? classifyPrompt(prompt.prompt_text, identity) : null;
  // Sin identidad no se puede afirmar que el prompt sea limpio -> null, que la compuerta de
  // TAO trata como NO elegible (fail-safe).
  const promptClass = classification?.promptClass ?? null;

  if (promptClass && prompt.prompt_class !== promptClass) {
    await admin.from("prompt_sets").update({ prompt_class: promptClass }).eq("id", prompt.id);
  }

  // P0.2-B — snapshot del prompt. `prompt_id` es solo el LINAJE (que plantilla), no la
  // evidencia: run-measurement escribe sobre prompt_sets unas lineas mas arriba, asi que la
  // fila referenciada es mutable. El texto literal y su hash son lo que hace reconstruible
  // la medicion.
  const promptTextExecuted = prompt.prompt_text;
  const promptHash = hashPromptText(promptTextExecuted);

  // IDEMPOTENCIA — estado por celda (prompt x motor) dentro de ESTA sesion.
  //
  // Decide, para cada motor, si hay que llamarlo o no. En la primera pasada no existe
  // ningun run previo, asi que se llaman los tres — el comportamiento de siempre. En una
  // pasada de reintento se excluyen:
  //   - los que ya tienen canonico (no se gasta API repitiendo un exito),
  //   - los `skipped` (motor sin credencial: volver a llamarlo daria skipped otra vez),
  //   - los que agotaron MAX_ATTEMPTS_PER_CELL.
  const { data: sessionRuns } = await admin
    .from("tracking_runs")
    .select("prompt_id, engine, outcome, is_canonical, attempt")
    .eq("session_id", sessionId)
    .eq("prompt_id", prompt.id);

  const cellByEngine = new Map<string, CellState>();
  for (const cell of buildCellStates(sessionRuns ?? []).get(prompt.id) ?? []) {
    cellByEngine.set(cell.engine, cell);
  }

  const summary: MeasurementSummary = { promptSetId, promptText: prompt.prompt_text, results: [] };

  const pending: ActiveEngine[] = [];
  const attemptByEngine = new Map<string, number>();

  for (const engine of ACTIVE_ENGINES) {
    const cell = cellByEngine.get(engine) ?? { engine, hasCanonical: false, lastOutcome: null, attempts: 0 };
    attemptByEngine.set(engine, cell.attempts);

    if (shouldRetryCell(cell)) {
      pending.push(engine);
    } else if (cell.hasCanonical) {
      summary.results.push({ engine, status: "already_measured" });
    } else if (cell.lastOutcome === "skipped") {
      summary.results.push({ engine, status: "skipped", reason: "motor sin credencial (no se reintenta)" });
    } else {
      summary.results.push({
        engine,
        status: "error",
        outcome: (cell.lastOutcome as RunOutcome) ?? "failed",
        message: `Sin canonico tras ${cell.attempts} intentos; no se reintenta mas.`,
      });
    }
  }

  const callers: Record<ActiveEngine, (p: string) => Promise<EngineOutcome>> = {
    openai: runOpenAI,
    anthropic: runAnthropic,
    gemini: runGemini,
    perplexity: runPerplexity,
  };

  const settled = await Promise.allSettled(pending.map((engine) => callers[engine](prompt.prompt_text)));

  for (let i = 0; i < pending.length; i += 1) {
    const engine = pending[i];
    const result = settled[i];
    const attempt = (attemptByEngine.get(engine) ?? 0) + 1;

    // Base comun de todo run, tenga exito o no. Un fallo se guarda como FILA REAL: sin esto
    // un timeout es indistinguible de "el negocio no aparece", que es exactamente la
    // confusion que P0.2-B elimina.
    const base = {
      client_id: prompt.client_id,
      prompt_id: prompt.id,
      session_id: sessionId,
      engine,
      attempt,
      prompt_class: promptClass,
      prompt_text_executed: promptTextExecuted,
      prompt_hash: promptHash,
      classifier_version: CLASSIFIER_VERSION,
    };

    if (result.status === "rejected") {
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason);
      const outcome = outcomeFromError(message);
      await admin.from("tracking_runs").insert({
        ...base,
        outcome,
        is_canonical: false,
        // `mentioned` es NOT NULL en el esquema. `false` aqui NO significa "no aparecio":
        // este run no es canonico y outcome != success, asi que ni TAO ni el pilar 6 pueden
        // verlo. La compuerta de P0.1 lee unicamente canonicos.
        mentioned: false,
        mention_method: null,
        response_raw: null,
      });
      summary.results.push({ engine, status: "error", outcome, message });
      continue;
    }

    const outcome = result.value;

    if (isSkipped(outcome)) {
      // `skipped` NO entra al denominador de cobertura (closeSession lo descuenta): un motor
      // sin credencial es alcance reducido y declarado, no cobertura perdida. Penalizar al
      // cliente por una decision nuestra seria incorrecto.
      await admin.from("tracking_runs").insert({
        ...base,
        outcome: "skipped",
        is_canonical: false,
        mentioned: false,
        mention_method: null,
        response_raw: null,
      });
      summary.results.push({ engine, status: "skipped", reason: outcome.reason });
      continue;
    }

    const mention = await classifyMention(outcome.raw, client.business_name);

    const { data: trackingRun, error: insertError } = await admin
      .from("tracking_runs")
      .insert({
        ...base,
        outcome: "success",
        // El indice unico parcial (session_id, prompt_id, engine) WHERE is_canonical impide
        // que un retry produzca dos canonicos. La garantia es de Postgres, no de este codigo.
        is_canonical: true,
        mentioned: mention.mentioned,
        mention_method: mention.method,
        response_raw: outcome.raw,
        provider: outcome.provider ?? null,
        model_requested: outcome.modelRequested ?? null,
        model_resolved: outcome.modelResolved ?? null,
        request_config: (outcome.requestConfig ?? null) as Json,
        request_config_hash: outcome.requestConfig ? hashRequestConfig(outcome.requestConfig) : null,
      })
      .select("id")
      .single();

    if (insertError || !trackingRun) {
      summary.results.push({
        engine,
        status: "error",
        outcome: "failed",
        message: `No se pudo insertar tracking_run: ${insertError?.message}`,
      });
      continue;
    }

    let citationCount = 0;
    for (const citation of outcome.citations) {
      const domain = citation.domainHint ?? extractDomain(citation.url);
      if (!domain) continue;

      const { error: citationError } = await admin.from("citations").insert({
        tracking_run_id: trackingRun.id,
        cited_url: citation.url,
        cited_domain: domain,
        is_client_domain: isClientDomain(domain, clientDomains),
        is_directory: isDirectoryDomain(domain, directorySources ?? []),
      });
      if (!citationError) citationCount += 1;
    }

    summary.results.push({
      engine,
      status: "inserted",
      trackingRunId: trackingRun.id,
      mentioned: mention.mentioned,
      citations: citationCount,
    });
  }

  return summary;
}

/**
 * Traduce el error de un motor a un `outcome`. La distincion importa: `rate_limited` y
 * `timeout` son transitorios y reintentables, `invalid_response` señala un bug propio que
 * merece alerta. Todos comparten lo esencial — ninguno produce canonico, ninguno cuenta
 * como ausencia.
 */
function outcomeFromError(message: string): RunOutcome {
  const m = message.toLowerCase();
  if (m.includes("429") || m.includes("rate limit") || m.includes("quota")) return "rate_limited";
  if (m.includes("timeout") || m.includes("timed out") || m.includes("etimedout") || m.includes("abort")) {
    return "timeout";
  }
  if (m.includes("json") || m.includes("unexpected token") || m.includes("parse")) return "invalid_response";
  return "failed";
}
