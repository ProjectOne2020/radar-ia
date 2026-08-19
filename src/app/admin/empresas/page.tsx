import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import EnterpriseLeadActions from "./enterprise-lead-actions";

// M24 — panel "modo dios" del flujo Enterprise: cotizar, aprobar y cobrar solicitudes
// que llegan desde /empresas. Mismo patron visual utilitario que /admin/partners
// (estilos inline, no el design system del producto — estas paginas son herramientas
// internas, no cara al cliente).
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
    <main style={{ padding: 60, maxWidth: 800, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">← Volver</Link>
      </p>
      <h1>Solicitudes Enterprise</h1>

      <h2>Pendientes ({pending.length})</h2>
      {pending.length === 0 && <p>Sin solicitudes pendientes.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {pending.map((lead) => (
          <div key={lead.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            <p>
              <strong>{lead.business_name}</strong> · {lead.created_at ? new Date(lead.created_at).toLocaleString() : ""} ·{" "}
              {lead.status === "quoted" ? "Cotizada" : "Pendiente"}
            </p>
            <p style={{ fontSize: 13 }}>
              Contacto: {lead.contact_name} · {lead.email} · {lead.phone_whatsapp}
            </p>
            <p style={{ fontSize: 13 }}>
              Sitio: {lead.website_url ?? "—"} · Ciudad/país: {lead.city ?? "—"}, {lead.country ?? "—"}
            </p>
            {lead.message && <p style={{ fontSize: 13, color: "#444", marginTop: 4 }}>&quot;{lead.message}&quot;</p>}
            <EnterpriseLeadActions
              leadId={lead.id}
              status={lead.status}
              currency={lead.currency}
              quotedSetupFee={lead.quoted_setup_fee}
              quotedRecurringFee={lead.quoted_recurring_fee}
              checkoutUrl={lead.checkout_url}
            />
          </div>
        ))}
      </div>

      {done.length > 0 && (
        <>
          <h2>Resueltas ({done.length})</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                <th>Negocio</th>
                <th>Contacto</th>
                <th>Estado</th>
                <th>Cotización</th>
              </tr>
            </thead>
            <tbody>
              {done.map((lead) => (
                <tr key={lead.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td>{lead.business_name}</td>
                  <td>{lead.email}</td>
                  <td>{lead.status === "approved" ? "Aprobada" : "Rechazada"}</td>
                  <td>
                    {lead.quoted_setup_fee !== null && lead.quoted_recurring_fee !== null
                      ? `${lead.currency} ${lead.quoted_setup_fee} + ${lead.quoted_recurring_fee}/mes`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
