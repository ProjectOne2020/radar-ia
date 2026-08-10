import type { AuditFindingDraft } from "./types";

interface PromptLike {
  prompt_text: string;
}

// Pilar 5 (cobertura de preguntas, 12%) — no tenia modulo que lo midiera hasta esta
// decision del fundador (ver M4). Reutiliza el HTML ya obtenido para el pilar 3 y el
// patron de Groq barato de M2: por cada prompt_set activo, Groq clasifica si el
// contenido de la pagina responde esa pregunta con claridad.
//
// El hallazgo de resumen usa un formato "N/M respondidas" deliberadamente parseable por
// M4 (audit_findings no tiene columna numerica — es texto por esquema literal).
export async function auditQuestionCoverage(
  html: string,
  fetched: boolean,
  prompts: PromptLike[]
): Promise<AuditFindingDraft[]> {
  if (!fetched) {
    return [
      {
        pillar: 5,
        finding: "No se pudo obtener el HTML del sitio para evaluar cobertura de preguntas.",
        severity: "info",
        detail_locked: true,
      },
    ];
  }

  if (prompts.length === 0) {
    return [
      {
        pillar: 5,
        finding: "No hay preguntas activas configuradas para evaluar cobertura de contenido.",
        severity: "info",
        detail_locked: true,
      },
    ];
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return [
      {
        pillar: 5,
        finding: "Cobertura de preguntas no evaluada: falta GROQ_API_KEY.",
        severity: "info",
        detail_locked: true,
      },
    ];
  }

  const textContent = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);

  let answeredCount = 0;
  const perQuestionFindings: AuditFindingDraft[] = [];

  for (const prompt of prompts) {
    const answered = await classifyAnswersQuestion(textContent, prompt.prompt_text, apiKey);
    if (answered) answeredCount += 1;
    perQuestionFindings.push({
      pillar: 5,
      finding: `Pregunta "${prompt.prompt_text}": ${answered ? "el sitio la responde con claridad" : "el sitio NO la responde con claridad"}.`,
      severity: answered ? "info" : "warning",
      detail_locked: true,
    });
  }

  const total = prompts.length;
  const ratio = answeredCount / total;

  return [
    {
      pillar: 5,
      finding: `Cobertura de preguntas: ${answeredCount}/${total} respondidas con claridad (según análisis de contenido).`,
      severity: ratio >= 0.7 ? "info" : ratio >= 0.4 ? "warning" : "critical",
      detail_locked: false,
    },
    ...perQuestionFindings,
  ];
}

async function classifyAnswersQuestion(pageText: string, question: string, apiKey: string): Promise<boolean> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Determinas si el contenido de una pagina web responde con claridad a una pregunta de intencion de compra/consulta de un usuario. Responde solo JSON: {"answered": true|false}.',
        },
        { role: "user", content: `Pregunta: "${question}"\n\nContenido de la pagina:\n${pageText}` },
      ],
    }),
  });

  if (!res.ok) return false;

  const data = await res.json();
  try {
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    return Boolean(parsed.answered);
  } catch {
    return false;
  }
}
