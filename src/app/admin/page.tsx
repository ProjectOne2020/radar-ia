import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRecurringFee, isManualCurrency, type PlanId } from "@/lib/pricing/plans";

// M12 — vista agregada del negocio. MRR se muestra POR MONEDA, nunca convertido/sumado
// a una sola cifra — 01-CONTEXTO-NEGOCIO.md prohibe recalcular por tipo de cambio en
// tiempo real, sumar monedas distintas seria exactamente eso.
export default async function AdminHomePage() {
  await requireAdmin();
  const admin = createAdminClient();

  const [{ data: clients }, { data: activeSubs }] = await Promise.all([
    admin.from("clients").select("id, plan, country, niche, verification_status, onboarding_type"),
    admin.from("subscriptions").select("client_id, plan, status, clients(currency)").eq("status", "active"),
  ]);

  // Los clientes internos (auditoria gratis M6, competidores M7) no son negocios reales
  // — se identifican porque nunca pasan por onboarding_type real de M5/M6 con intencion
  // de compra... en la practica, el unico marcador confiable hoy es no tener suscripcion.
  // Para esta vista se cuentan solo los que SI tienen alguna fila en subscriptions.
  const { data: allSubClientIds } = await admin.from("subscriptions").select("client_id");
  const realClientIds = new Set((allSubClientIds ?? []).map((s) => s.client_id));
  const realClients = (clients ?? []).filter((c) => realClientIds.has(c.id));

  const activeCount = (activeSubs ?? []).length;
  // flagged se cuenta sobre TODOS los clientes, no solo los "reales" con suscripcion —
  // una cuenta puede quedar marcada por anti-abuso antes de llegar a pagar nada.
  const flaggedCount = (clients ?? []).filter((c) => c.verification_status === "flagged").length;

  const mrrByCurrency: Record<string, number> = {};
  for (const sub of activeSubs ?? []) {
    const currency = (sub.clients as { currency?: string } | null)?.currency;
    if (!currency || !isManualCurrency(currency)) continue;
    const fee = getRecurringFee(sub.plan as PlanId, currency);
    if (fee === null) continue;
    mrrByCurrency[currency] = (mrrByCurrency[currency] ?? 0) + fee;
  }

  const byPlan: Record<string, number> = {};
  const byCountry: Record<string, number> = {};
  const byNiche: Record<string, number> = {};
  for (const c of realClients) {
    byPlan[c.plan] = (byPlan[c.plan] ?? 0) + 1;
    byCountry[c.country] = (byCountry[c.country] ?? 0) + 1;
    byNiche[c.niche] = (byNiche[c.niche] ?? 0) + 1;
  }

  return (
    <main style={{ padding: 60, maxWidth: 800, fontFamily: "sans-serif" }}>
      <h1>Panel de administración — Radar IA</h1>
      <nav style={{ display: "flex", gap: 16, margin: "16px 0" }}>
        <Link href="/admin/clientes">Todos los clientes</Link>
        <Link href="/admin/flagged">Cuentas marcadas ({flaggedCount})</Link>
        <Link href="/admin/partners">Partners</Link>
      </nav>

      <h2>Métricas del negocio</h2>
      <p>Clientes con negocio real (con historial de suscripción): {realClients.length}</p>
      <p>Suscripciones activas: {activeCount}</p>

      <h3>MRR por moneda</h3>
      {Object.keys(mrrByCurrency).length === 0 ? (
        <p>Sin suscripciones activas todavía.</p>
      ) : (
        <ul>
          {Object.entries(mrrByCurrency).map(([currency, amount]) => (
            <li key={currency}>
              {currency}: {amount.toLocaleString()}
            </li>
          ))}
        </ul>
      )}

      <h3>Distribución por plan</h3>
      <ul>
        {Object.entries(byPlan).map(([plan, count]) => (
          <li key={plan}>
            {plan}: {count}
          </li>
        ))}
      </ul>

      <h3>Distribución por país</h3>
      <ul>
        {Object.entries(byCountry).map(([country, count]) => (
          <li key={country}>
            {country}: {count}
          </li>
        ))}
      </ul>

      <h3>Distribución por nicho</h3>
      <ul>
        {Object.entries(byNiche).map(([niche, count]) => (
          <li key={niche}>
            {niche}: {count}
          </li>
        ))}
      </ul>
    </main>
  );
}
