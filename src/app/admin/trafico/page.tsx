import { requireAdmin } from "@/lib/admin/require-admin";
import { getVisitCounts } from "@/lib/vercel-analytics/query";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatCard } from "@/components/admin/stat-card";
import { Panel, Alert } from "@/components/ui/panel";
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
    <AdminShell title="Tráfico del sitio">
      <Panel raised className="mb-6">
        <h2 className="mb-2 font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
          Ahora mismo
        </h2>
        <LiveOnline />
      </Panel>

      <h2 className="mb-3 font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
        Visitas por período
      </h2>
      {visits.error && (
        <Alert tone="neutral" className="mb-4">
          {visits.error}{" "}
          <a
            href="https://vercel.com/alejandros-projects-729c3d69/radar-ia/analytics"
            target="_blank"
            rel="noopener noreferrer"
            className="text-signal-strong hover:underline"
          >
            Ver en el dashboard de Vercel
          </a>
          .
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Últimas 24 horas" value={visits.last24h ?? "—"} />
        <StatCard label="Últimos 7 días" value={visits.last7d ?? "—"} />
        <StatCard label="Últimos 30 días" value={visits.last30d ?? "—"} />
        <StatCard label="Últimos 365 días" value={visits.last365d ?? "—"} />
      </div>
    </AdminShell>
  );
}
