import type { EngineOutcome } from "./types";

// Perplexity Agent API — NO Sonar Chat Completions.
//
// P0.3 (sep 2026) — Perplexity vuelve a ACTIVE_ENGINES: el fundador confirmo credito
// cargado en la cuenta. Se reescribio este adaptador desde cero contra el endpoint nuevo
// en vez de arreglar el viejo, porque el viejo (`/chat/completions`, modelo "sonar") se
// deprecia el 27/09/2026 (confirmado en la documentacion oficial de Perplexity, sep 2026:
// "Sonar Chat Completions is now Agent API. Sonar will be supported until September 27,
// 2026.") — arreglarlo hubiera sido trabajo tirado en menos de dos semanas.
//
// Endpoint: POST https://api.perplexity.ai/v1/agent (compatible con el estandar Open
// Responses — mismo shape de "output" tipado que la Responses API de OpenAI).
// Modelo: "perplexity/sonar" — el modelo propio de Perplexity dentro de la Agent API,
// deliberadamente NO "openai/..." ni "anthropic/..." (esos ya se miden directo en
// openai.ts/anthropic.ts; usar el router de Perplexity para llamar a esos mismos
// proveedores duplicaria motores, no agregaria uno nuevo).
const MODEL = "perplexity/sonar";

// Misma leccion que anthropic.ts: no asumir que el modelo va a buscar solo. La docs de
// Perplexity dicen textual "The model decides when to call it [web_search] based on your
// prompt and instructions" — no hay un tool_choice="required" documentado como en
// Anthropic/OpenAI, asi que la mitigacion aqui es doble: `instructions` explicita
// ordenando la busqueda, y pedirla igual por si el campo se soporta (no rompe si se
// ignora). Si en produccion se ve mention_method cayendo a fallback de substring para este
// motor con frecuencia, es la señal de que esto no basta y hay que revisitarlo.
const INSTRUCTIONS =
  "You have access to a web_search tool. You must always call it at least once before " +
  "answering, even if you think you already know the answer — the goal is a grounded, " +
  "source-backed response, not a memorized one.";

export async function runPerplexity(promptText: string): Promise<EngineOutcome> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return { engine: "perplexity", reason: "PERPLEXITY_API_KEY no configurada" };

  // P0.2-B — declarada una sola vez: se envia y se guarda en el run, sin poder derivar.
  const requestConfig = {
    model: MODEL,
    tools: [{ type: "web_search" }],
    tool_choice: "required",
    instructions: INSTRUCTIONS,
  };

  const res = await fetch("https://api.perplexity.ai/v1/agent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: requestConfig.model,
      input: promptText,
      tools: requestConfig.tools,
      tool_choice: requestConfig.tool_choice,
      instructions: requestConfig.instructions,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Perplexity API error ${res.status}: ${body}`);
  }

  const data = await res.json();

  // El "output" de la Agent API es un array de items TIPADOS (no choices/citations planos
  // como el viejo Sonar): tipicamente uno o mas "search_results" (busquedas hechas) seguidos
  // de un "message" final (la respuesta). Se recorre sin asumir orden ni cantidad fija de
  // pasos — un preset "low" puede buscar una vez, "high" puede iterar varias.
  type SearchResultItem = { type: "search_results"; results?: Array<{ url?: string }> };
  type MessageContentBlock = {
    type: string;
    text?: string;
    annotations?: Array<{ type?: string; url?: string }>;
  };
  type MessageItem = { type: "message"; content?: MessageContentBlock[] };
  type OutputItem = SearchResultItem | MessageItem | { type: string; [k: string]: unknown };

  const output: OutputItem[] = Array.isArray(data.output) ? data.output : [];

  const messageItems = output.filter((o): o is MessageItem => o.type === "message");
  const raw = messageItems
    .flatMap((m) => m.content ?? [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text ?? "")
    .join("\n");

  // Citas: de los pasos de busqueda (results[].url) y de las anotaciones inline del mensaje
  // final (url_citation), union sin duplicados — el mismo dominio puede aparecer en ambos.
  const searchUrls = output
    .filter((o): o is SearchResultItem => o.type === "search_results")
    .flatMap((s) => s.results ?? [])
    .map((r) => r.url)
    .filter((u): u is string => Boolean(u));

  const annotationUrls = messageItems
    .flatMap((m) => m.content ?? [])
    .flatMap((c) => c.annotations ?? [])
    .map((a) => a.url)
    .filter((u): u is string => Boolean(u));

  const citations = Array.from(new Set([...searchUrls, ...annotationUrls])).map((url) => ({ url }));

  return {
    engine: "perplexity",
    raw,
    citations,
    provider: "perplexity",
    modelRequested: MODEL,
    modelResolved: typeof data.model === "string" ? data.model : undefined,
    requestConfig,
  };
}
