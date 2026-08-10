import type { EngineOutcome } from "./types";

// OpenAI Responses API con la herramienta de web search nativa.
// NO PROBADO EN VIVO todavia — implementado siguiendo la documentacion oficial de la
// Responses API (POST /v1/responses, tools: [{ type: "web_search" }]). Falta OPENAI_API_KEY
// para verificar el shape real de la respuesta (anotaciones de citas en el content).
export async function runOpenAI(promptText: string): Promise<EngineOutcome> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { engine: "openai", reason: "OPENAI_API_KEY no configurada" };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      input: promptText,
      tools: [{ type: "web_search" }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${body}`);
  }

  const data = await res.json();

  // El output es un array de items; el mensaje final tiene type "message" con content
  // bloques de type "output_text" que incluyen "annotations" con las citas (type "url_citation").
  type Annotation = { type: string; url?: string };
  type ContentBlock = { type: string; text?: string; annotations?: Annotation[] };
  type OutputItem = { type: string; content?: ContentBlock[] };

  const output: OutputItem[] = data.output ?? [];
  const message = output.find((item) => item.type === "message");
  const textBlocks = message?.content?.filter((c) => c.type === "output_text") ?? [];

  const raw = textBlocks.map((b) => b.text ?? "").join("\n");
  const citedUrls = Array.from(
    new Set(
      textBlocks
        .flatMap((b) => b.annotations ?? [])
        .filter((a) => a.type === "url_citation" && a.url)
        .map((a) => a.url as string)
    )
  );

  return { engine: "openai", raw, citedUrls };
}
