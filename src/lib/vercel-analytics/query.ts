// M17 — reporte de visitas diario/semanal/mensual/anual pedido por el fundador. Vercel
// Web Analytics no tiene SDK oficial para consultas server-side, se usa la API REST
// documentada (GET /v1/query/web-analytics/visits/count) directamente con fetch, mismo
// estilo "sin SDK extra" que ya usa el proyecto para otras integraciones externas.
const PROJECT_ID = "prj_S6OX4vYF1eoUuvmUMPAkSaQIAirA";
const TEAM_ID = "team_XTdhtrdaKVmwJYp4mqGklNPg";

export interface VisitCounts {
  last24h: number | null;
  last7d: number | null;
  last30d: number | null;
  last365d: number | null;
  // null en cualquier campo = no se pudo consultar (sin token, o Web Analytics
  // "not_enabled" todavia porque no ha llegado trafico real desde que se activo).
  error: string | null;
}

async function countVisits(since: Date, until: Date, token: string): Promise<number | null> {
  const params = new URLSearchParams({
    projectId: PROJECT_ID,
    teamId: TEAM_ID,
    since: since.toISOString(),
    until: until.toISOString(),
  });

  const res = await fetch(`https://api.vercel.com/v1/query/web-analytics/visits/count?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    // Reporte del panel de admin, no necesita estar al segundo — cachear 5 min evita
    // pegarle a la API de Vercel en cada carga de /admin/trafico.
    next: { revalidate: 300 },
  });

  if (!res.ok) return null;
  const data = await res.json();
  return typeof data?.data?.count === "number" ? data.data.count : null;
}

export async function getVisitCounts(): Promise<VisitCounts> {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) {
    return { last24h: null, last7d: null, last30d: null, last365d: null, error: "Falta VERCEL_API_TOKEN." };
  }

  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  try {
    const [last24h, last7d, last30d, last365d] = await Promise.all([
      countVisits(daysAgo(1), now, token),
      countVisits(daysAgo(7), now, token),
      countVisits(daysAgo(30), now, token),
      countVisits(daysAgo(365), now, token),
    ]);

    const allNull = last24h === null && last7d === null && last30d === null && last365d === null;
    return {
      last24h,
      last7d,
      last30d,
      last365d,
      error: allNull
        ? "Sin datos todavía — Web Analytics se activa solo cuando llega tráfico real después de desplegar el script de tracking."
        : null,
    };
  } catch (err) {
    return {
      last24h: null,
      last7d: null,
      last30d: null,
      last365d: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
