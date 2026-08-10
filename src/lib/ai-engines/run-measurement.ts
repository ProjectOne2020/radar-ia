import { createAdminClient } from "@/lib/supabase/admin";
import { runOpenAI } from "./openai";
import { runAnthropic } from "./anthropic";
import { runGemini } from "./gemini";
import { runPerplexity } from "./perplexity";
import { runBingCopilot } from "./bing";
import { classifyMention } from "./classify";
import { extractDomain, isClientDomain, isDirectoryDomain } from "./classify-domain";
import { isSkipped, type EngineOutcome } from "./types";

export interface MeasurementSummary {
  promptSetId: string;
  promptText: string;
  results: Array<
    | { engine: string; status: "inserted"; trackingRunId: string; mentioned: boolean; citations: number }
    | { engine: string; status: "skipped"; reason: string }
    | { engine: string; status: "error"; message: string }
  >;
}

// M2 — corre un prompt_set contra los 5 motores, parsea, y persiste tracking_runs + citations.
export async function runMeasurementForPromptSet(promptSetId: string): Promise<MeasurementSummary> {
  const admin = createAdminClient();

  const { data: prompt, error: promptError } = await admin
    .from("prompt_sets")
    .select("id, prompt_text, client_id")
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

  const engineRuns = await Promise.allSettled<EngineOutcome>([
    runOpenAI(prompt.prompt_text),
    runAnthropic(prompt.prompt_text),
    runGemini(prompt.prompt_text),
    runPerplexity(prompt.prompt_text),
    runBingCopilot(),
  ]);

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

    const mentioned = await classifyMention(outcome.raw, client.business_name);

    const { data: trackingRun, error: insertError } = await admin
      .from("tracking_runs")
      .insert({
        client_id: prompt.client_id,
        prompt_id: prompt.id,
        engine: outcome.engine,
        mentioned,
        response_raw: outcome.raw,
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
