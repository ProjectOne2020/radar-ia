import { requirePartner } from "@/lib/partners/require-partner";
import { createAdminClient } from "@/lib/supabase/admin";
import { PartnerShell } from "@/components/partners/partner-shell";
import { Badge } from "@/components/ui/badge";

export default async function PartnerClientsPage() {
  const partner = await requirePartner();
  const admin = createAdminClient();

  const { data: clients } = await admin
    .from("clients")
    .select("id, business_name, niche, country, plan, created_at")
    .eq("partner_id", partner.id)
    .order("created_at", { ascending: false });

  const clientIds = (clients ?? []).map((c) => c.id);
  const [{ data: subs }, { data: scores }] = await Promise.all([
    clientIds.length > 0
      ? admin.from("subscriptions").select("client_id, status").in("client_id", clientIds)
      : Promise.resolve({ data: [] as { client_id: string | null; status: string }[] }),
    clientIds.length > 0
      ? admin
          .from("ai_visibility_scores")
          .select("client_id, score_total, calculated_at")
          .in("client_id", clientIds)
          .order("calculated_at", { ascending: false })
      : Promise.resolve({ data: [] as { client_id: string | null; score_total: number; calculated_at: string | null }[] }),
  ]);

  const subByClient = new Map((subs ?? []).map((s) => [s.client_id, s.status]));
  const latestScoreByClient = new Map<string, number>();
  for (const s of scores ?? []) {
    if (!s.client_id || latestScoreByClient.has(s.client_id)) continue;
    latestScoreByClient.set(s.client_id, s.score_total);
  }

  return (
    <PartnerShell agencyName={partner.agency_name} title={`Mis clientes (${clients?.length ?? 0})`}>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-strong bg-paper-raised text-left text-xs tracking-wide text-text-secondary uppercase">
              <th className="px-4 py-3 font-medium">Negocio</th>
              <th className="px-4 py-3 font-medium">Rubro / país</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Suscripción</th>
            </tr>
          </thead>
          <tbody>
            {(clients ?? []).map((c) => {
              const subStatus = subByClient.get(c.id);
              const score = latestScoreByClient.get(c.id);
              return (
                <tr key={c.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 text-ink">{c.business_name}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {c.niche} · {c.country}
                  </td>
                  <td className="px-4 py-3 text-text-secondary capitalize">{c.plan}</td>
                  <td className="px-4 py-3 font-mono text-ink">{score !== undefined ? Math.round(score) : "—"}</td>
                  <td className="px-4 py-3">
                    {subStatus ? (
                      <Badge tone={subStatus === "active" ? "good" : "neutral"}>{subStatus}</Badge>
                    ) : (
                      <span className="text-text-muted">sin suscripción</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(clients ?? []).length === 0 && <p className="mt-4 text-sm text-text-muted">Todavía no tienes clientes referidos.</p>}
    </PartnerShell>
  );
}
