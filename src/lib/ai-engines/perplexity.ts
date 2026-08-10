import type { EngineOutcome } from "./types";

// Perplexity Sonar — devuelve las citas directamente en el campo top-level "citations".
// NO PROBADO EN VIVO todavia — falta PERPLEXITY_API_KEY.
export async function runPerplexity(promptText: string): Promise<EngineOutcome> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return { engine: "perplexity", reason: "PERPLEXITY_API_KEY no configurada" };

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [{ role: "user", content: promptText }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Perplexity API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const raw: string = data.choices?.[0]?.message?.content ?? "";
  const rawCitations: string[] = Array.isArray(data.citations) ? data.citations : [];
  const citations = rawCitations.map((url) => ({ url }));

  return { engine: "perplexity", raw, citations };
}
