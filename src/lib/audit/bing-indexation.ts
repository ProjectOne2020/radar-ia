import type { AuditFindingDraft } from "./types";

// Investigacion confirmada en vivo (agosto 2026): la API de "AI Performance" de Bing
// (citas reales de Copilot, lanzada en preview publico el 9 de feb 2026) NO tiene acceso
// programatico todavia — solo dashboard (confirmado por Microsoft Q&A y el blog de
// anuncio de Bing; probado tambien en vivo contra la API real, todos los nombres de
// metodo candidatos devuelven "Endpoint not found"). Por la regla de decision del
// fundador: esto NUNCA va a tracking_runs, ni aproximado — el producto corre con 4
// motores reales en el pilar 8 (OpenAI, Anthropic, Gemini, Perplexity), no 5 forzados.
//
// Ademas: la API de Bing Webmaster Tools (GetQueryStats, GetPageStats) solo devuelve
// datos de sitios VERIFICADOS en la cuenta de la API key usada (probado en vivo: pedir
// datos de un sitio ajeno devuelve ErrorCode 14 "NotAuthorized"). Esto hace que ni la
// señal de indexacion tradicional se pueda usar para auditoria gratis ni competidores —
// solo aplica a clientes pagados que verifiquen su propio sitio en la cuenta de Bing
// Webmaster Tools de Radar IA (paso de onboarding pendiente de construir, similar al
// GBP real por OAuth). Aqui NO se aproxima nada: si el sitio no esta verificado, el
// hallazgo dice explicitamente que la señal no esta disponible, no se inventa un dato.
export async function auditBingIndexation(websiteUrl: string): Promise<AuditFindingDraft[]> {
  const apiKey = process.env.BING_WEBMASTER_API_KEY;
  if (!apiKey) {
    return [
      {
        pillar: 3,
        finding: "Señal de indexacion en Bing no disponible: falta BING_WEBMASTER_API_KEY.",
        severity: "info",
        detail_locked: true,
      },
    ];
  }

  const encodedUrl = encodeURIComponent(websiteUrl);
  const res = await fetch(
    `https://ssl.bing.com/webmaster/api.svc/json/GetQueryStats?apikey=${apiKey}&siteUrl=${encodedUrl}`
  );
  const data = await res.json();

  if (data.ErrorCode === 14) {
    return [
      {
        pillar: 3,
        finding:
          "Señal de indexacion en Bing no disponible: el sitio no esta verificado en la cuenta de Bing Webmaster Tools de Radar IA (requiere que el cliente lo verifique — funcion de plan pagado).",
        severity: "info",
        detail_locked: true,
      },
    ];
  }

  if (data.ErrorCode !== undefined) {
    return [
      {
        pillar: 3,
        finding: `Error consultando Bing Webmaster Tools: ${data.Message ?? data.ErrorCode}.`,
        severity: "info",
        detail_locked: true,
      },
    ];
  }

  const queryStats: unknown[] = Array.isArray(data.d) ? data.d : [];
  const hasActivity = queryStats.length > 0;

  return [
    {
      pillar: 3,
      finding: hasActivity
        ? `El sitio tiene actividad de indexacion en Bing (según datos públicos de Bing Webmaster Tools: ${queryStats.length} consultas con impresiones en los últimos 6 meses).`
        : "El sitio no muestra actividad de indexacion en Bing en los últimos 6 meses (según datos públicos de Bing Webmaster Tools) — puede ser un sitio nuevo o con baja visibilidad en ese motor.",
      severity: hasActivity ? "info" : "warning",
      detail_locked: false,
    },
  ];
}
