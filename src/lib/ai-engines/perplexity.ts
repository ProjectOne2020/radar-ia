import type { EngineOutcome } from "./types";

// Perplexity Sonar — devuelve las citas directamente en el campo top-level "citations".
//
// ⚠️ PENDIENTE (agosto 2026): el unico de los 4 motores del pilar 8 sin probar en vivo
// todavia. OpenAI (M2), Anthropic (M2) y Gemini (M2) ya estan confirmados con llamadas
// reales y evidencia de busqueda web verificada; Perplexity sigue solo sobre el papel
// (implementado segun su documentacion oficial, shape de respuesta sin confirmar) porque
// PERPLEXITY_API_KEY no tiene credito todavia. No cerrar el pilar 8 como "4 motores
// probados" hasta resolver este pendiente — ver runMeasurementForPromptSet en
// run-measurement.ts, que ya opera correctamente con 3/4 motores mientras tanto.
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
