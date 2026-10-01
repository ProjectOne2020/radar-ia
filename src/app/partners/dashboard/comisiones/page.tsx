import { requirePartner } from "@/lib/partners/require-partner";
import { createAdminClient } from "@/lib/supabase/admin";
import { PartnerShell } from "@/components/partners/partner-shell";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL: Record<string, { label: string; tone: "good" | "warning" | "neutral" }> = {
  paid_auto: { label: "Pagada automático", tone: "good" },
  paid_manual: { label: "Pagada (manual)", tone: "good" },
  pending_manual: { label: "Pendiente de pago", tone: "warning" },
};

export default async function PartnerCommissionsPage() {
  const partner = await requirePartner();
  const admin = createAdminClient();

  const { data: commissions } = await admin
    .from("partner_commissions")
    .select("id, amount, currency, status, created_at, paid_at, client_id, clients(business_name)")
    .eq("partner_id", partner.id)
    .order("created_at", { ascending: false });

  return (
    <PartnerShell agencyName={partner.agency_name} title={`Comisiones (${commissions?.length ?? 0})`}>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-strong bg-paper-raised text-left text-xs tracking-wide text-text-secondary uppercase">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Monto</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Generada</th>
            </tr>
          </thead>
          <tbody>
            {(commissions ?? []).map((c) => {
              const status = STATUS_LABEL[c.status] ?? { label: c.status, tone: "neutral" as const };
              return (
                <tr key={c.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 text-ink">{c.clients?.business_name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-ink">
                    {(c.amount / 100).toFixed(2)} {c.currency.toUpperCase()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {c.created_at ? new Date(c.created_at).toLocaleDateString("es") : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(commissions ?? []).length === 0 && (
        <p className="mt-4 text-sm text-text-muted">Todavía no se generó ninguna comisión.</p>
      )}
      <p className="mt-4 text-xs text-text-muted">
        Las comisiones "pendientes de pago" las paga Radar IA por fuera de la plataforma (transferencia u otro medio
        acordado) — no es un pago automático para tu país todavía.
      </p>
    </PartnerShell>
  );
}
