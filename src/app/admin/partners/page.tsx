import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
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
    <main style={{ padding: 60, maxWidth: 800, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">← Volver</Link>
      </p>
      <h1>Partners / reseller</h1>

      <h2>Solicitudes pendientes ({pending.length})</h2>
      {pending.length === 0 && <p>Sin solicitudes pendientes.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {pending.map((a) => (
          <div key={a.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            <p>
              <strong>{a.agency_name}</strong> · {a.created_at ? new Date(a.created_at).toLocaleString() : ""}
            </p>
            <p style={{ fontSize: 13 }}>
              Contacto: {a.contact_name} · {a.email} · {a.phone_whatsapp}
            </p>
            <p style={{ fontSize: 13 }}>
              Sitio: {a.website_url ?? "—"} · Negocios que maneja: {a.client_count ?? "—"}
            </p>
            {a.message && (
              <p style={{ fontSize: 13, color: "#444", marginTop: 4 }}>&quot;{a.message}&quot;</p>
            )}
            <ApplicationActions applicationId={a.id} />
          </div>
        ))}
      </div>

      {reviewed.length > 0 && (
        <>
          <h2>Solicitudes revisadas ({reviewed.length})</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                <th>Agencia</th>
                <th>Contacto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {reviewed.map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td>{a.agency_name}</td>
                  <td>{a.email}</td>
                  <td>{a.status === "accepted" ? "Aceptada" : "Rechazada"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Partners activos</h2>
      <NewPartnerForm />

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Agencia</th>
            <th>Revenue share</th>
            <th>Estado</th>
            <th>Clientes atribuidos</th>
          </tr>
        </thead>
        <tbody>
          {(partners ?? []).map((p) => (
            <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{p.agency_name}</td>
              <td>{p.revenue_share_pct !== null ? `${p.revenue_share_pct}%` : "—"}</td>
              <td>{p.status}</td>
              <td>{countsByPartner.get(p.id) ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(partners ?? []).length === 0 && <p>Sin partners todavía.</p>}
    </main>
  );
}
