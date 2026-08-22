import { createAdminClient } from "@/lib/supabase/admin";
import { runOpenAI } from "./openai";
import { runAnthropic } from "./anthropic";
import { runGemini } from "./gemini";
// NOTA: `./perplexity` NO se importa a proposito. El codigo se conserva intacto para una
// futura migracion a la Agent API (la Chat Completions que implementa queda sin soporte el
// 27/09/2026), pero el motor esta fuera de ACTIVE_ENGINES y no debe llamarse.
import { classifyMention } from "./classify";
import { extractDomain, isClientDomain, isDirectoryDomain } from "./classify-domain";
import { ACTIVE_ENGINES, isSkipped, type EngineOutcome } from "./types";
import { loadClientIdentity } from "@/lib/identity/load-identity";
import { classifyPrompt } from "@/lib/prompt-class/classify-prompt";

export interface MeasurementSummary {
  promptSetId: string;
  promptText: string;
  results: Array<
    | { engine: string; status: "inserted"; trackingRunId: string; mentioned: boolean; citations: number }
    | { engine: string; status: "skipped"; reason: string }
    | { engine: string; status: "error"; message: string }
  >;
}

// M2 — corre un prompt_set contra los motores ACTIVOS del pilar 8 (ver ACTIVE_ENGINES en
// ai-engines/types.ts: OpenAI, Anthropic, Gemini), parsea, y persiste tracking_runs +
// citations. bing_copilot y perplexity NO participan — ver types.ts para el motivo de cada uno.
//
// P0.1 — Cada tracking_run guarda ahora `prompt_class` y `mention_method`. Sin esos dos
// campos la compuerta de TAO no puede distinguir una medicion limpia de una contaminada ni
// de una degradada, que es exactamente como se colaba el sesgo en v1.
export async function runMeasurementForPromptSet(promptSetId: string): Promise<MeasurementSummary> {
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

  // P0.1 — Clase de contaminacion del prompt, decidida de forma DETERMINISTA antes de
  // medir. Se calcula aqui (y no solo al crear el prompt) para que la clase refleje la
  // identidad vigente del cliente, y se guarda como snapshot en cada tracking_run: si
  // mañana alguien edita la pregunta o el nombre del negocio, la evidencia de que ESTA
  // medicion vino de un prompt limpio no cambia retroactivamente.
  const identity = await loadClientIdentity(admin, prompt.client_id);
  const classification = identity ? classifyPrompt(prompt.prompt_text, identity) : null;
  // Sin identidad no se puede afirmar que el prompt sea limpio -> se deja null, que la
  // compuerta de TAO trata como NO elegible (fail-safe).
  const promptClass = classification?.promptClass ?? null;

  // Persistir la clase tambien en el prompt para que el admin pueda verla sin recalcular.
  if (promptClass && prompt.prompt_class !== promptClass) {
    await admin.from("prompt_sets").update({ prompt_class: promptClass }).eq("id", prompt.id);
  }

  // Solo se llaman los motores ACTIVOS (ver ai-engines/types.ts). Perplexity queda fuera
  // por decision de producto, no por falta de codigo.
  const engineCalls: Record<(typeof ACTIVE_ENGINES)[number], Promise<EngineOutcome>> = {
    openai: runOpenAI(prompt.prompt_text),
    anthropic: runAnthropic(prompt.prompt_text),
    gemini: runGemini(prompt.prompt_text),
  };
  const engineRuns = await Promise.allSettled<EngineOutcome>(
    ACTIVE_ENGINES.map((name) => engineCalls[name]),
  );

  const summary: MeasurementSummary = { promptSetId, promptText: prompt.prompt_text, results: [] };

  for (const settled of engineRuns) {
    if (settled.status === "rejected") {
      const message = settled.reason instanceof Error ? settled.reason.message : String(settled.reason);
      summary.results.push({ engine: "unknown", status: "error", message });
      continue;
    }

    const outcome = settled.value;

    if (isSkipped(outcome)) {
      summary.results.push({ engine: outcome.engine, status: "skipped", reason: outcome.reason });
      continue;
    }

    const mention = await classifyMention(outcome.raw, client.business_name);
    const mentioned = mention.mentioned;

    const { data: trackingRun, error: insertError } = await admin
      .from("tracking_runs")
      .insert({
        client_id: prompt.client_id,
        prompt_id: prompt.id,
        engine: outcome.engine,
        mentioned,
        response_raw: outcome.raw,
        prompt_class: promptClass,
        mention_method: mention.method,
      })
      .select("id")
      .single();

    if (insertError || !trackingRun) {
      summary.results.push({
        engine: outcome.engine,
        status: "error",
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
      engine: outcome.engine,
      status: "inserted",
      trackingRunId: trackingRun.id,
      mentioned,
      citations: citationCount,
    });
  }

  return summary;
}
