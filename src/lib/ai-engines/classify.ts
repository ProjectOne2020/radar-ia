import { GROQ_MODEL } from "@/lib/groq/model";

// Procesamiento intermedio barato (regla de costo de 03-ARQUITECTURA-TECNICA.md: usar
// Groq para todo lo que no sea la medicion final). Aqui solo se decide si el
// negocio fue mencionado — no es el dato del producto, es parseo de la respuesta cruda
// que ya se obtuvo del motor real.
//
// P0.1 — Ahora devuelve TAMBIEN el metodo usado. Antes solo devolvia un booleano, asi que
// una caida de Groq producia silenciosamente una clasificacion por substring
// indistinguible de una buena. La regla central de P0.1 prohibe que una clasificacion por
// fallback alimente la TAO ("ni por fallback, ni por substring"), y para poder excluirla
// hay que saber que ocurrio: por eso el metodo viaja hasta `tracking_runs.mention_method`.

export type MentionMethod = "llm" | "substring_fallback";

export interface MentionClassification {
  mentioned: boolean;
  method: MentionMethod;
  /**
   * true cuando el texto se recorto antes de clasificar. La evidencia guardada
   * (`response_raw`) es completa, asi que un recorte puede hacer que la conclusion
   * contradiga la evidencia — queda registrado para no afirmar mas de lo medido.
   *
   * TODO(P0.3): eliminar el recorte o tratar el run como `partial` en la maquina de
   * estados de medicion. En P0.1 solo se registra; no se cambia el comportamiento.
   */
  inputTruncated: boolean;
}

const CLASSIFIER_INPUT_LIMIT = 6000;

export async function classifyMention(
  rawText: string,
  businessName: string,
): Promise<MentionClassification> {
  const apiKey = process.env.GROQ_API_KEY;
  const inputTruncated = rawText.length > CLASSIFIER_INPUT_LIMIT;

  if (!rawText.trim()) {
    return { mentioned: false, method: "llm", inputTruncated: false };
  }

  // Fallback barato sin red: coincidencia simple de substring, por si Groq no esta
  // configurada. Se marca SIEMPRE como substring_fallback para que la compuerta de TAO
  // pueda descartarlo (ver src/lib/metrics/tao.ts).
  const naive: MentionClassification = {
    mentioned: rawText.toLowerCase().includes(businessName.toLowerCase()),
    method: "substring_fallback",
    inputTruncated,
  };
  if (!apiKey) return naive;

  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
            content: `Negocio: "${businessName}"\n\nTexto:\n${rawText.slice(0, CLASSIFIER_INPUT_LIMIT)}`,
          },
        ],
      }),
    });
  } catch {
    // Error de red: antes esto lanzaba y mataba la medicion completa del prompt en los 4
    // motores (la excepcion escapaba del bucle de run-measurement y se la tragaba un
    // Promise.allSettled). Ahora degrada de forma explicita y trazable.
    return naive;
  }

  if (!res.ok) return naive;

  // El JSON.parse del cuerpo tambien va protegido: un 200 con cuerpo no-JSON lanzaba
  // desde aqui y producia el mismo efecto que arriba.
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return naive;
  }

  try {
    const content = (data as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]
      ?.message?.content;
    const parsed = JSON.parse(content ?? "{}");
    return { mentioned: Boolean(parsed.mentioned), method: "llm", inputTruncated };
  } catch {
    return naive;
  }
}
