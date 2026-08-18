import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import NewPartnerForm from "./new-partner-form";

export default async function AdminPartnersPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: partners } = await admin
    .from("partner_accounts")
    .select("id, agency_name, revenue_share_pct, status, created_at")
    .order("created_at", { ascending: false });

  const { data: clientCounts } = await admin.from("clients").select("partner_id").not("partner_id", "is", null);
  const countsByPartner = new Map<string, number>();
  for (const c of clientCounts ?? []) {
    if (!c.partner_id) continue;
    countsByPartner.set(c.partner_id, (countsByPartner.get(c.partner_id) ?? 0) + 1);
  }

  return (
    <main style={{ padding: 60, maxWidth: 800, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">← Volver</Link>
      </p>
      <h1>Partners / reseller</h1>

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
