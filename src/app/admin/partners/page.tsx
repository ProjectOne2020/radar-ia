import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminShell } from "@/components/admin/admin-shell";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import NewPartnerForm from "./new-partner-form";
import ApplicationActions from "./application-actions";

export default async function AdminPartnersPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const [{ data: partners }, { data: applications }] = await Promise.all([
    admin
      .from("partner_accounts")
      .select("id, agency_name, revenue_share_pct, status, created_at")
      .order("created_at", { ascending: false }),
    admin
      .from("partner_applications")
      .select(
        "id, agency_name, contact_name, email, phone_whatsapp, website_url, client_count, message, status, created_at",
      )
      .order("created_at", { ascending: false }),
  ]);

  const { data: clientCounts } = await admin.from("clients").select("partner_id").not("partner_id", "is", null);
  const countsByPartner = new Map<string, number>();
  for (const c of clientCounts ?? []) {
    if (!c.partner_id) continue;
    countsByPartner.set(c.partner_id, (countsByPartner.get(c.partner_id) ?? 0) + 1);
  }

  const pending = (applications ?? []).filter((a) => a.status === "pending");
  const reviewed = (applications ?? []).filter((a) => a.status !== "pending");

  return (
    <AdminShell title="Partners / reseller">
      <section className="mb-8">
        <h2 className="mb-3 font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
          Solicitudes pendientes ({pending.length})
        </h2>
        {pending.length === 0 && <p className="text-sm text-text-muted">Sin solicitudes pendientes.</p>}
        <div className="flex flex-col gap-3">
          {pending.map((a) => (
            <Panel key={a.id}>
              <p className="text-ink">
                <span className="font-medium">{a.agency_name}</span>
                <span className="text-text-secondary"> · {a.created_at ? new Date(a.created_at).toLocaleString("es") : ""}</span>
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Contacto: {a.contact_name} · {a.email} · {a.phone_whatsapp}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Sitio: {a.website_url ?? "—"} · Negocios que maneja: {a.client_count ?? "—"}
              </p>
              {a.message && <p className="mt-2 text-sm text-text-muted italic">&quot;{a.message}&quot;</p>}
              <ApplicationActions applicationId={a.id} />
            </Panel>
          ))}
        </div>
      </section>

      {reviewed.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
            Solicitudes revisadas ({reviewed.length})
          </h2>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[500px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-strong bg-paper-raised text-left text-xs tracking-wide text-text-secondary uppercase">
                  <th className="px-4 py-3 font-medium">Agencia</th>
                  <th className="px-4 py-3 font-medium">Contacto</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {reviewed.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 text-ink">{a.agency_name}</td>
                    <td className="px-4 py-3 text-text-secondary">{a.email}</td>
                    <td className="px-4 py-3">
                      <Badge tone={a.status === "accepted" ? "good" : "critical"}>
                        {a.status === "accepted" ? "Aceptada" : "Rechazada"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
          Partners activos
        </h2>
        <NewPartnerForm />

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-strong bg-paper-raised text-left text-xs tracking-wide text-text-secondary uppercase">
                <th className="px-4 py-3 font-medium">Agencia</th>
                <th className="px-4 py-3 font-medium">Revenue share</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Clientes atribuidos</th>
              </tr>
            </thead>
            <tbody>
              {(partners ?? []).map((p) => (
                <tr key={p.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 text-ink">{p.agency_name}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {p.revenue_share_pct !== null ? `${p.revenue_share_pct}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{p.status}</td>
                  <td className="px-4 py-3 font-mono text-ink">{countsByPartner.get(p.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(partners ?? []).length === 0 && <p className="mt-3 text-sm text-text-muted">Sin partners todavía.</p>}
      </section>
    </AdminShell>
  );
}
