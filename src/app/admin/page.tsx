import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRecurringFee, isManualCurrency, type PlanId } from "@/lib/pricing/plans";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatCard } from "@/components/admin/stat-card";
import { DistBarChart, TrendBarChart } from "@/components/admin/dist-bar-chart";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";

const QUICK_LINKS = [
  { href: "/admin/clientes", label: "Todos los clientes" },
  { href: "/admin/auditorias", label: "Auditorías" },
  { href: "/admin/flagged", label: "Cuentas marcadas" },
  { href: "/admin/partners", label: "Partners" },
  { href: "/admin/empresas", label: "Enterprise" },
  { href: "/admin/preguntas", label: "Banco de preguntas" },
  { href: "/admin/importar-contenido", label: "Importar contenido" },
  { href: "/admin/trafico", label: "Tráfico" },
];

// M12 — vista agregada del negocio. MRR se muestra POR MONEDA, nunca convertido/sumado
// a una sola cifra — 01-CONTEXTO-NEGOCIO.md prohibe recalcular por tipo de cambio en
// tiempo real, sumar monedas distintas seria exactamente eso.
export default async function AdminHomePage() {
  await requireAdmin();
  const admin = createAdminClient();

  const [
    { data: clients },
    { data: activeSubs },
    { count: freeAuditsCount },
    { data: subscribedClientIds },
    { data: recentScores },
    { data: activeTrialGrants },
  ] = await Promise.all([
    admin.from("clients").select("id, plan, country, niche, verification_status, onboarding_type"),
    admin.from("subscriptions").select("client_id, plan, status, clients(currency)").eq("status", "active"),
    admin.from("free_audits").select("id", { count: "exact", head: true }),
    admin.from("subscriptions").select("client_id"),
    admin
      .from("ai_visibility_scores")
      .select("calculated_at")
      .order("calculated_at", { ascending: false })
      .limit(1000),
    admin.from("trial_grants").select("client_id").eq("active", true),
  ]);

  // Un cliente NO ha pagado de verdad si (a) su "suscripcion activa" viene de un trial
  // gratuito otorgado a mano (src/lib/admin/trial-grant.ts, nunca toca Stripe) mientras
  // ese trial siga activo, o (b) es la cuenta "founder" del propio fundador (acceso de
  // por vida sin plan, ver plans.ts) — ninguna de las dos debe contarse como cliente
  // pagador, suscripcion activa, ni sumar a MRR/distribucion por plan.
  const unpaidClientIds = new Set((activeTrialGrants ?? []).map((g) => g.client_id));
  const isRealPayer = (clientId: string | null, plan: string) =>
    !!clientId && plan !== "founder" && !unpaidClientIds.has(clientId);

  // Auditorias "de plan pagado": toda medicion (ai_visibility_scores) de un cliente que
  // tiene o tuvo alguna suscripcion realmente pagada — incluye el checkout inicial y cada
  // re-medicion periodica de M11, no solo la primera. Excluye trials activos y la cuenta
  // founder, igual que el resto de estas metricas.
  const clientPlanById = new Map((clients ?? []).map((c) => [c.id, c.plan]));
  const paidClientIds = Array.from(
    new Set(
      (subscribedClientIds ?? [])
        .filter((s) => s.client_id && isRealPayer(s.client_id, clientPlanById.get(s.client_id) ?? ""))
        .map((s) => s.client_id as string),
    ),
  );
  const { count: paidAuditsCount } =
    paidClientIds.length > 0
      ? await admin
          .from("ai_visibility_scores")
          .select("id", { count: "exact", head: true })
          .in("client_id", paidClientIds)
      : { count: 0 };

  // Los clientes internos (auditoria gratis M6, competidores M7) no son negocios reales
  // — se identifican porque nunca pasan por onboarding_type real de M5/M6 con intencion
  // de compra... en la practica, el marcador es tener alguna fila en subscriptions Y que
  // esa suscripcion sea un pago real (no un trial activo ni la cuenta founder).
  const realClients = (clients ?? []).filter((c) => paidClientIds.includes(c.id));

  const paidActiveSubs = (activeSubs ?? []).filter((s) => isRealPayer(s.client_id, s.plan));
  const activeCount = paidActiveSubs.length;
  const trialCount = unpaidClientIds.size;
  // flagged se cuenta sobre TODOS los clientes, no solo los que pagan —
  // una cuenta puede quedar marcada por anti-abuso antes de llegar a pagar nada.
  const flaggedCount = (clients ?? []).filter((c) => c.verification_status === "flagged").length;

  const mrrByCurrency: Record<string, number> = {};
  for (const sub of paidActiveSubs) {
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

  const toSortedEntries = (rec: Record<string, number>) =>
    Object.entries(rec)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

  // Auditorías por día (últimos 14 días) — para ver si el volumen sube o baja.
  const days: Array<{ key: string; label: string; value: number }> = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ key, label: d.toLocaleDateString("es", { day: "2-digit", month: "2-digit" }), value: 0 });
  }
  const dayIndex = new Map(days.map((d, i) => [d.key, i]));
  for (const s of recentScores ?? []) {
    if (!s.calculated_at) continue;
    const key = s.calculated_at.slice(0, 10);
    const idx = dayIndex.get(key);
    if (idx !== undefined) days[idx].value += 1;
  }

  return (
    <AdminShell title="Panel de administración">
      <div className="mb-8 flex flex-wrap gap-2">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-xs border border-border-strong px-3 py-1.5 text-sm text-text-secondary transition-colors duration-[var(--duration-micro)] hover:border-signal hover:text-ink"
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard label="Clientes que pagan" value={realClients.length} hint="Suscripción real, sin trials" />
        <StatCard label="Suscripciones activas" value={activeCount} tone="signal" />
        <StatCard
          label="En trial gratuito"
          value={trialCount}
          tone={trialCount > 0 ? "warning" : "neutral"}
          hint="Sin pagar — no cuentan en MRR"
        />
        <StatCard
          label="Cuentas marcadas"
          value={flaggedCount}
          tone={flaggedCount > 0 ? "critical" : "good"}
          hint={flaggedCount > 0 ? "Revisar en /admin/flagged" : "Ninguna"}
        />
        <StatCard label="Auditorías gratis" value={freeAuditsCount ?? 0} hint="Histórico total" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Panel raised>
          <h2 className="mb-4 font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
            Auditorías por día (últimos 14 días)
          </h2>
          <TrendBarChart points={days} />
        </Panel>

        <Panel raised>
          <h2 className="mb-4 font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
            MRR por moneda
          </h2>
          {Object.keys(mrrByCurrency).length === 0 ? (
            <p className="text-sm text-text-muted">Sin suscripciones activas todavía.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {Object.entries(mrrByCurrency).map(([currency, amount]) => (
                <Badge key={currency} tone="signal">
                  {currency} {amount.toLocaleString()}
                </Badge>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-text-muted">
            Auditorías en planes pagados (checkout inicial + re-mediciones): {paidAuditsCount ?? 0}
          </p>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Panel raised>
          <h2 className="mb-4 font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
            Por plan
          </h2>
          <DistBarChart data={toSortedEntries(byPlan)} />
        </Panel>
        <Panel raised>
          <h2 className="mb-4 font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
            Por país
          </h2>
          <DistBarChart data={toSortedEntries(byCountry)} />
        </Panel>
        <Panel raised>
          <h2 className="mb-4 font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
            Por nicho
          </h2>
          <DistBarChart data={toSortedEntries(byNiche)} />
        </Panel>
      </div>
    </AdminShell>
  );
}
