import type { EngineOutcome } from "./types";

// Anthropic Messages API con la herramienta de web search nativa.
// Modelo configurable via ANTHROPIC_MODEL — default claude-haiku-4-5-20251001 (el nivel
// mas economico disponible), indicacion explicita del fundador: este motor es medicion
// pura, no requiere el modelo mas capaz. Igual que en openai.ts, es para no gastar
// credito en pruebas de desarrollo, no un cambio de que se mide en el pilar 8.
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

// BUG REAL encontrado en pruebas (agosto 2026): a diferencia de OpenAI, Anthropic deja la
// invocacion de web_search a discreccion del modelo — probado en vivo, con este mismo
// prompt el modelo a veces respondio "no tengo acceso a informacion actualizada" SIN
// buscar, en vez de usar la herramienta. Eso invalidaria la medicion (pareceria
// "no mencionado" cuando en realidad nunca se busco). tool_choice fuerza la busqueda
// siempre — verificado en vivo que asi si trae server_tool_use + citas reales.

export async function runAnthropic(promptText: string): Promise<EngineOutcome> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { engine: "anthropic", reason: "ANTHROPIC_API_KEY no configurada" };

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: promptText }],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      tool_choice: { type: "tool", name: "web_search" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  const data = await res.json();

  type Citation = { type: string; url?: string };
  type ContentBlock = { type: string; text?: string; citations?: Citation[] };

  const blocks: ContentBlock[] = data.content ?? [];
  const textBlocks = blocks.filter((b) => b.type === "text");

  const raw = textBlocks.map((b) => b.text ?? "").join("\n");
  const citations = textBlocks
    .flatMap((b) => b.citations ?? [])
    .filter((c) => c.url)
    .map((c) => ({ url: c.url as string }));

  return { engine: "anthropic", raw, citations };
}
