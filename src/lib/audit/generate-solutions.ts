import { GROQ_MODEL } from "@/lib/groq/model";

export interface FindingInput {
  pillar: number;
  finding: string;
  severity: string | null;
}

export interface FindingSolution {
  finding: string;
  solution: string;
}

interface BusinessContext {
  name: string;
  niche: string;
  country: string;
}

// A demanda desde el boton "Generar soluciones con IA" en /admin/clientes/[id] — nunca se
// llama automaticamente al auditar, para no gastar Groq en cada carga de la ficha. Solo se
// piden soluciones para hallazgos critical/warning: uno "info" ya esta bien, no hay nada
// que resolver.
export async function generateSolutionsForFindings(
  business: BusinessContext,
  findings: FindingInput[],
): Promise<FindingSolution[]> {
  const actionable = findings.filter((f) => f.severity === "critical" || f.severity === "warning");
  if (actionable.length === 0) return [];

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Falta GROQ_API_KEY");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Eres un consultor experto en GEO/AEO (visibilidad de negocios en motores de IA como ChatGPT, Claude, " +
            "Gemini y Perplexity). Para cada problema de auditoria que te den de un negocio especifico, escribe una " +
            "solucion CONCRETA, ACCIONABLE y PERSONALIZADA para ese negocio — nunca un consejo generico de manual. " +
            "Usa su nombre, rubro y pais cuando ayude a que la recomendacion se sienta especifica. Maximo 3-4 " +
            'oraciones por solucion. Responde SOLO JSON con este formato exacto: {"solutions": [{"finding": ' +
            '"<el texto EXACTO del hallazgo que te dieron, sin modificarlo>", "solution": "<tu solucion>"}]}.',
        },
        {
          role: "user",
          content: `Negocio: "${business.name}" (rubro: ${business.niche}, país: ${business.country}).\n\nProblemas a resolver:\n${actionable
            .map((f) => `- [Pilar ${f.pillar}] ${f.finding}`)
            .join("\n")}`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Groq respondió ${res.status}`);

  const data = await res.json();
  let parsed: unknown;
  try {
    parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  } catch {
    throw new Error("Groq devolvió una respuesta que no es JSON válido");
  }

  const solutions = (parsed as { solutions?: unknown }).solutions;
  if (!Array.isArray(solutions)) return [];

  return solutions.filter(
    (s): s is FindingSolution =>
      typeof s === "object" && s !== null && typeof (s as FindingSolution).finding === "string" && typeof (s as FindingSolution).solution === "string",
  );
}
