import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { getVisitCounts } from "@/lib/vercel-analytics/query";
import LiveOnline from "./live-online";

// Trafico web pedido por el fundador. "Online ahora" se construye con Supabase Realtime
// Presence (src/components/presence-tracker.tsx) porque Vercel Analytics no ofrece
// presencia en tiempo real, solo pageviews agregados con retraso. El reporte
// diario/semanal/mensual/anual usa la API REST de Vercel Web Analytics
// (src/lib/vercel-analytics/query.ts) con VERCEL_API_TOKEN.
export default async function TraficoPage() {
  await requireAdmin();

  const visits = await getVisitCounts();

  return (
    <main style={{ padding: 60, maxWidth: 800, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">← Volver</Link>
      </p>
      <h1>Tráfico del sitio</h1>

      <LiveOnline />

      <h2>Visitas por período</h2>
      {visits.error && (
        <p style={{ color: "#666", fontSize: 14 }}>
          {visits.error}{" "}
          <a
            href="https://vercel.com/alejandros-projects-729c3d69/radar-ia/analytics"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver en el dashboard de Vercel
          </a>
          .
        </p>
      )}
      <ul style={{ fontSize: 18, lineHeight: 1.8 }}>
        <li>Últimas 24 horas: {visits.last24h ?? "—"}</li>
        <li>Últimos 7 días: {visits.last7d ?? "—"}</li>
        <li>Últimos 30 días: {visits.last30d ?? "—"}</li>
        <li>Últimos 365 días: {visits.last365d ?? "—"}</li>
      </ul>
    </main>
  );
}
