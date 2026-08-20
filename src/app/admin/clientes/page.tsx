import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";

export default async function AdminClientesPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const [{ data: clients }, { data: scores }, { data: subs }, { data: activeTrialGrants }] = await Promise.all([
    admin
      .from("clients")
      .select("id, business_name, plan, country, niche, verification_status, onboarding_type, created_at")
      .order("created_at", { ascending: false }),
    admin
      .from("ai_visibility_scores")
      .select("client_id, score_total, calculated_at")
      .order("calculated_at", { ascending: false }),
    admin.from("subscriptions").select("client_id, status, setup_fee_paid, current_period_end"),
    admin.from("trial_grants").select("client_id").eq("active", true),
  ]);

  const latestScoreByClient = new Map<string, number>();
  for (const s of scores ?? []) {
    if (!s.client_id || latestScoreByClient.has(s.client_id)) continue;
    latestScoreByClient.set(s.client_id, s.score_total);
  }

  const subByClient = new Map<string, { status: string; setup_fee_paid: boolean | null }>();
  for (const s of subs ?? []) {
    if (!s.client_id) continue;
    subByClient.set(s.client_id, { status: s.status, setup_fee_paid: s.setup_fee_paid });
  }

  const trialClientIds = new Set((activeTrialGrants ?? []).map((g) => g.client_id));

  return (
    <AdminShell title={`Todos los clientes (${clients?.length ?? 0})`}>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-strong bg-paper-raised text-left text-xs tracking-wide text-text-secondary uppercase">
              <th className="px-4 py-3 font-medium">Negocio</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">País</th>
              <th className="px-4 py-3 font-medium">Nicho</th>
              <th className="px-4 py-3 font-medium">Verificación</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Suscripción</th>
            </tr>
          </thead>
          <tbody>
            {(clients ?? []).map((c) => {
              const sub = subByClient.get(c.id);
              const score = latestScoreByClient.get(c.id);
              return (
                <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-surface">
                  <td className="px-4 py-3">
                    <Link href={`/admin/clientes/${c.id}`} className="font-medium text-ink hover:text-signal-strong">
                      {c.business_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {c.plan === "founder" ? (
                      <Badge tone="signal">acceso ilimitado</Badge>
                    ) : (
                      <span className="capitalize">{c.plan}</span>
                    )}
                    {trialClientIds.has(c.id) && (
                      <Badge tone="warning" className="ml-2">
                        trial, sin pagar
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{c.country}</td>
                  <td className="px-4 py-3 text-text-secondary">{c.niche}</td>
                  <td className="px-4 py-3">
                    <Badge tone={c.verification_status === "flagged" ? "critical" : "neutral"}>
                      {c.verification_status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-ink">{score !== undefined ? Math.round(score) : "—"}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {sub ? (
                      <span>
                        {sub.status}
                        {sub.setup_fee_paid ? " · setup pagado" : " · setup pendiente"}
                      </span>
                    ) : (
                      "sin suscripción"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
