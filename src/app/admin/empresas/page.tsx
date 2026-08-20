import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminShell } from "@/components/admin/admin-shell";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import EnterpriseLeadActions from "./enterprise-lead-actions";

// M24 — panel "modo dios" del flujo Enterprise: cotizar, aprobar y cobrar solicitudes
// que llegan desde /empresas.
export default async function AdminEmpresasPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: leads } = await admin
    .from("enterprise_leads")
    .select("*")
    .order("created_at", { ascending: false });

  const pending = (leads ?? []).filter((l) => l.status === "pending" || l.status === "quoted");
  const done = (leads ?? []).filter((l) => l.status === "approved" || l.status === "rejected");

  return (
    <AdminShell title="Solicitudes Enterprise">
      <section className="mb-8">
        <h2 className="mb-3 font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
          Pendientes ({pending.length})
        </h2>
        {pending.length === 0 && <p className="text-sm text-text-muted">Sin solicitudes pendientes.</p>}
        <div className="flex flex-col gap-3">
          {pending.map((lead) => (
            <Panel key={lead.id}>
              <p className="flex flex-wrap items-center gap-2 text-ink">
                <span className="font-medium">{lead.business_name}</span>
                <span className="text-text-secondary">
                  · {lead.created_at ? new Date(lead.created_at).toLocaleString("es") : ""}
                </span>
                <Badge tone={lead.status === "quoted" ? "signal" : "neutral"}>
                  {lead.status === "quoted" ? "Cotizada" : "Pendiente"}
                </Badge>
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Contacto: {lead.contact_name} · {lead.email} · {lead.phone_whatsapp}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Sitio: {lead.website_url ?? "—"} · Ciudad/país: {lead.city ?? "—"}, {lead.country ?? "—"}
              </p>
              {lead.message && <p className="mt-2 text-sm text-text-muted italic">&quot;{lead.message}&quot;</p>}
              <EnterpriseLeadActions
                leadId={lead.id}
                status={lead.status}
                currency={lead.currency}
                quotedSetupFee={lead.quoted_setup_fee}
                quotedRecurringFee={lead.quoted_recurring_fee}
                checkoutUrl={lead.checkout_url}
              />
            </Panel>
          ))}
        </div>
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
            Resueltas ({done.length})
          </h2>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-strong bg-paper-raised text-left text-xs tracking-wide text-text-secondary uppercase">
                  <th className="px-4 py-3 font-medium">Negocio</th>
                  <th className="px-4 py-3 font-medium">Contacto</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Cotización</th>
                </tr>
              </thead>
              <tbody>
                {done.map((lead) => (
                  <tr key={lead.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 text-ink">{lead.business_name}</td>
                    <td className="px-4 py-3 text-text-secondary">{lead.email}</td>
                    <td className="px-4 py-3">
                      <Badge tone={lead.status === "approved" ? "good" : "critical"}>
                        {lead.status === "approved" ? "Aprobada" : "Rechazada"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {lead.quoted_setup_fee !== null && lead.quoted_recurring_fee !== null
                        ? `${lead.currency} ${lead.quoted_setup_fee} + ${lead.quoted_recurring_fee}/mes`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AdminShell>
  );
}
