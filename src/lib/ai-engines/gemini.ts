import type { EngineOutcome } from "./types";

// Google Gemini con grounding (Google Search) — probado en vivo con GOOGLE_AI_API_KEY.
export async function runGemini(promptText: string): Promise<EngineOutcome> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return { engine: "gemini", reason: "GOOGLE_AI_API_KEY no configurada" };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        tools: [{ google_search: {} }],
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

  const chunks: Array<{ web?: { uri?: string } }> =
    candidate?.groundingMetadata?.groundingChunks ?? [];
  const citedUrls = Array.from(
    new Set(chunks.map((c) => c.web?.uri).filter((u): u is string => Boolean(u)))
  );

  return { engine: "gemini", raw, citedUrls };
}
