import type { EngineOutcome } from "./types";

// Anthropic Messages API con la herramienta de web search nativa.
// NO PROBADO EN VIVO todavia — implementado siguiendo la documentacion oficial
// (tool type "web_search_20250305"). Falta ANTHROPIC_API_KEY para verificar el shape
// real de la respuesta (bloques de citas adjuntos a cada text block).
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
      model: "claude-sonnet-4-5",
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
  const citedUrls = Array.from(
    new Set(
      textBlocks
        .flatMap((b) => b.citations ?? [])
        .filter((c) => c.url)
        .map((c) => c.url as string)
    )
  );

  return { engine: "anthropic", raw, citedUrls };
}
