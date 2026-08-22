import type { EngineOutcome } from "./types";

// OpenAI Responses API con la herramienta de web search nativa.
//
// Modelo configurable via OPENAI_MODEL — en desarrollo se usa gpt-5.6-luna (barato,
// indicacion explicita del fundador, agosto 2026) en vez del alias corto "gpt-5.6", que
// apunta a Sol (el modelo caro), no a Luna. En produccion se puede fijar OPENAI_MODEL a
// otro valor sin tocar codigo. IMPORTANTE: esta es la medicion real del pilar 8 (no es
// procesamiento intermedio) — el modelo economico es solo para no gastar credito en
// pruebas de desarrollo, no una sustitucion permanente del motor de medicion.
const DEFAULT_MODEL = "gpt-5.6-luna";

export async function runOpenAI(promptText: string): Promise<EngineOutcome> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { engine: "openai", reason: "OPENAI_API_KEY no configurada" };

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: promptText,
      tools: [{ type: "web_search" }],
      // Forzado por seguridad/consistencia (ver mismo fix en anthropic.ts) — verificado
      // en vivo que sin esto el modelo a veces decide no buscar por su cuenta.
      tool_choice: "required",
      // P0.1 — Tope explicito de salida. Antes no habia ninguno: una respuesta larga podia
      // multiplicar el costo sin aviso (los tokens de salida son ~6x los de entrada en este
      // modelo). 1024 es el mismo valor que anthropic.ts ya usaba, elegido para no cambiar
      // el comportamiento de medicion — las respuestas reales observadas caben de sobra.
      max_output_tokens: 1024,
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
  const citations = textBlocks
    .flatMap((b) => b.annotations ?? [])
    .filter((a) => a.type === "url_citation" && a.url)
    .map((a) => ({ url: a.url as string }));

  return { engine: "openai", raw, citations };
}
