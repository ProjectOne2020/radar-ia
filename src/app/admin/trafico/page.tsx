import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import LiveOnline from "./live-online";

// Trafico web pedido por el fundador. "Online ahora" se construye con Supabase Realtime
// Presence (src/components/presence-tracker.tsx) porque Vercel Analytics no ofrece
// presencia en tiempo real, solo pageviews agregados con retraso. El reporte
// diario/semanal/mensual/anual usa Vercel Web Analytics — requiere un token de Vercel
// guardado como VERCEL_API_TOKEN, pendiente de que el fundador lo genere.
export default async function TraficoPage() {
  await requireAdmin();

  const hasVercelToken = Boolean(process.env.VERCEL_API_TOKEN);

  return (
    <main style={{ padding: 60, maxWidth: 800, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">← Volver</Link>
      </p>
      <h1>Tráfico del sitio</h1>

      <LiveOnline />

      <h2>Visitas por período</h2>
      {hasVercelToken ? (
        <p>(pendiente de construir la consulta a Vercel Web Analytics)</p>
      ) : (
        <p style={{ color: "#666" }}>
          Falta configurar <code>VERCEL_API_TOKEN</code> para mostrar el reporte de visitas
          diarias/semanales/mensuales/anuales aquí — mientras tanto puedes verlo directo en{" "}
          <a
            href="https://vercel.com/alejandros-projects-729c3d69/radar-ia/analytics"
            target="_blank"
            rel="noopener noreferrer"
          >
            el dashboard de Vercel
          </a>
          .
        </p>
      )}
    </main>
  );
}
