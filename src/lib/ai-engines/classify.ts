import { GROQ_MODEL } from "@/lib/groq/model";

// Procesamiento intermedio barato (regla de costo de 03-ARQUITECTURA-TECNICA.md: usar
// Groq para todo lo que no sea la medicion final). Aqui solo se decide si el
// negocio fue mencionado — no es el dato del producto, es parseo de la respuesta cruda
// que ya se obtuvo del motor real.
export async function classifyMention(rawText: string, businessName: string): Promise<boolean> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!rawText.trim()) return false;

  // Fallback barato sin red: coincidencia simple de substring, por si Groq no esta configurada.
  const naiveMatch = rawText.toLowerCase().includes(businessName.toLowerCase());
  if (!apiKey) return naiveMatch;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Determinas si un negocio especifico fue mencionado en un texto, incluyendo variantes de nombre razonables (abreviaturas, con/sin "Clinica", errores menores de formato). Responde solo JSON: {"mentioned": true|false}.',
        },
        {
          role: "user",
          content: `Negocio: "${businessName}"\n\nTexto:\n${rawText.slice(0, 6000)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    // Si Groq falla, no se bloquea la medicion — se cae al match simple.
    return naiveMatch;
  }

  const data = await res.json();
  try {
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    return Boolean(parsed.mentioned);
  } catch {
    return naiveMatch;
  }
}
