import type { EngineOutcome } from "./types";

// Google Gemini con grounding (Google Search) — probado en vivo con GOOGLE_AI_API_KEY.
// P0.2-B — el modelo viaja en la URL, no en el body. `-latest` es literalmente un alias
// movil: es el caso donde guardar `modelResolved` (data.modelVersion) mas importa.
const MODEL = "gemini-flash-latest";

export async function runGemini(promptText: string): Promise<EngineOutcome> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return { engine: "gemini", reason: "GOOGLE_AI_API_KEY no configurada" };

  const requestConfig = {
    tools: [{ google_search: {} }],
    // P0.1 — Tope explicito de salida. Antes no habia ninguno, y es el motor mas caro
    // de los tres por token de salida, asi que era la exposicion de costo mas grande
    // del sistema. 1024 iguala a openai.ts y anthropic.ts.
    generationConfig: { maxOutputTokens: 1024 },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        ...requestConfig,
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const raw: string =
    candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("\n") ?? "";

  // web.uri es un link de redirect de Vertex AI Search, no la URL real citada.
  // web.title trae el dominio real (ej. "dentalia.com") — se usa como domainHint.
  const chunks: Array<{ web?: { uri?: string; title?: string } }> =
    candidate?.groundingMetadata?.groundingChunks ?? [];
  const citations = chunks
    .filter((c): c is { web: { uri: string; title?: string } } => Boolean(c.web?.uri))
    .map((c) => ({ url: c.web.uri, domainHint: c.web.title }));

  return {
    engine: "gemini",
    raw,
    citations,
    provider: "google",
    modelRequested: MODEL,
    modelResolved: typeof data.modelVersion === "string" ? data.modelVersion : undefined,
    requestConfig,
  };
}
