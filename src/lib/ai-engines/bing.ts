import type { EngineOutcome } from "./types";

// El motor "bing_copilot" es distinto a los otros 4: Bing Webmaster Tools API no tiene un
// endpoint tipo chat ("pregunta y responde") — es una API de indexacion/rendimiento de
// busqueda (paginas indexadas, clics, impresiones por query). 03-ARQUITECTURA-TECNICA.md
// dice usarla "como fuente extra para el motor bing_copilot — reduce costo de API para
// ese motor especifico", pero no especifica el mapeo exacto senal -> tracking_run.
//
// Pendiente de decision de producto antes de implementar de verdad: ¿"mentioned" se infiere
// de que el dominio del cliente tenga paginas indexadas por Bing y ranking para queries
// relacionadas al prompt (via GetQueryStats / GetUrlTrafficInfo), o se prefiere consumir
// directamente la Chat Completions API de Bing/Copilot (si acaso hay acceso) y tratar esta
// fuente solo como señal complementaria en el pilar 3 (crawlability) en vez de en tracking_runs?
// No se asume una respuesta — se deja explicitamente fuera hasta confirmar con el fundador
// y tener BING_WEBMASTER_API_KEY para explorar el shape real de la API.
export async function runBingCopilot(): Promise<EngineOutcome> {
  const apiKey = process.env.BING_WEBMASTER_API_KEY;
  if (!apiKey) {
    return { engine: "bing_copilot", reason: "BING_WEBMASTER_API_KEY no configurada" };
  }
  return {
    engine: "bing_copilot",
    reason:
      "BING_WEBMASTER_API_KEY presente, pero el mapeo senal->tracking_run no esta definido todavia — pendiente de decision de producto",
  };
}
