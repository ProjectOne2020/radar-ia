import type { EngineOutcome } from "./types";

// Anthropic Messages API con la herramienta de web search nativa.
// Usa Claude Haiku (el modelo mas barato disponible) por indicacion explicita del
// fundador — este motor es medicion pura, no requiere el modelo mas capaz.
export async function runAnthropic(promptText: string): Promise<EngineOutcome> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { engine: "anthropic", reason: "ANTHROPIC_API_KEY no configurada" };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: promptText }],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
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
