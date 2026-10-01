import { requirePartner } from "@/lib/partners/require-partner";
import { createAdminClient } from "@/lib/supabase/admin";
import { isConnectEligible } from "@/lib/stripe/connect";
import { PartnerShell } from "@/components/partners/partner-shell";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import ConnectButton from "./connect-button";

const CONNECT_STATUS_LABEL: Record<string, string> = {
  not_started: "Sin conectar",
  pending: "Onboarding incompleto",
  complete: "Conectada",
};

export default async function PartnerDashboardPage() {
  const partner = await requirePartner();
  const admin = createAdminClient();

  const [{ count: clientCount }, { data: subs }, { data: commissions }] = await Promise.all([
    admin.from("clients").select("id", { count: "exact", head: true }).eq("partner_id", partner.id),
    admin
      .from("subscriptions")
      .select("client_id, status, clients!inner(partner_id)")
      .eq("clients.partner_id", partner.id)
      .eq("status", "active"),
    admin
      .from("partner_commissions")
      .select("amount, currency, status")
      .eq("partner_id", partner.id),
  ]);

  const paidCount = subs?.length ?? 0;

  const totalsByCurrency = new Map<string, { pending: number; paid: number }>();
  for (const c of commissions ?? []) {
    const entry = totalsByCurrency.get(c.currency) ?? { pending: 0, paid: 0 };
    if (c.status === "pending_manual") entry.pending += c.amount;
    else entry.paid += c.amount;
    totalsByCurrency.set(c.currency, entry);
  }

  const eligible = isConnectEligible(partner.country);

  return (
    <PartnerShell agencyName={partner.agency_name} title="Resumen">
      <div className="grid gap-4 sm:grid-cols-3">
        <Panel raised>
          <p className="text-xs tracking-wide text-text-secondary uppercase">Clientes referidos</p>
          <p className="mt-2 font-mono text-3xl text-ink">{clientCount ?? 0}</p>
        </Panel>
        <Panel raised>
          <p className="text-xs tracking-wide text-text-secondary uppercase">Convertidos a pago</p>
          <p className="mt-2 font-mono text-3xl text-ink">{paidCount}</p>
        </Panel>
        <Panel raised>
          <p className="text-xs tracking-wide text-text-secondary uppercase">% de comisión acordado</p>
          <p className="mt-2 font-mono text-3xl text-ink">
            {partner.revenue_share_pct !== null ? `${partner.revenue_share_pct}%` : "—"}
          </p>
        </Panel>
      </div>

      <Panel raised className="mt-4">
        <h2 className="mb-3 font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
          Comisiones
        </h2>
        {totalsByCurrency.size === 0 ? (
          <p className="text-sm text-text-muted">Todavía no hay comisiones generadas.</p>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            {[...totalsByCurrency.entries()].map(([currency, t]) => (
              <div key={currency} className="flex items-center justify-between border-b border-border pb-2 last:border-b-0">
                <span className="text-text-secondary uppercase">{currency}</span>
                <span className="text-ink">
                  Pendiente de pago: <strong>{(t.pending / 100).toFixed(2)}</strong> · Ya pagado:{" "}
                  <strong>{(t.paid / 100).toFixed(2)}</strong>
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-text-muted">
          Ver detalle en <span className="text-text">Comisiones</span>.
        </p>
      </Panel>

      {eligible ? (
        <Panel raised className="mt-4">
          <h2 className="mb-3 font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
            Pagos automáticos
          </h2>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Badge tone={partner.connect_onboarding_status === "complete" ? "good" : "neutral"}>
                {CONNECT_STATUS_LABEL[partner.connect_onboarding_status] ?? partner.connect_onboarding_status}
              </Badge>
              <p className="mt-2 max-w-[48ch] text-sm text-text-secondary">
                {partner.connect_onboarding_status === "complete"
                  ? "Tus comisiones se transfieren automáticamente a tu cuenta cuando un cliente que referiste paga."
                  : "Conecta tu cuenta bancaria para recibir tus comisiones automáticamente en vez de que te las paguemos por fuera."}
              </p>
            </div>
            <ConnectButton label={partner.connect_onboarding_status === "complete" ? "Ver cuenta" : "Conectar cuenta de pago"} />
          </div>
        </Panel>
      ) : (
        <Panel raised className="mt-4">
          <h2 className="mb-3 font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
            Pagos
          </h2>
          <p className="text-sm text-text-secondary">
            Los pagos automáticos por ahora solo están disponibles para agencias en México. Tus comisiones se
            calculan igual aquí — el pago te lo hacemos por fuera (transferencia u otro medio que acuerdes
            directamente).
          </p>
        </Panel>
      )}
    </PartnerShell>
  );
}
