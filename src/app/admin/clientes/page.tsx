import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminClientesPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const [{ data: clients }, { data: scores }, { data: subs }] = await Promise.all([
    admin
      .from("clients")
      .select("id, business_name, plan, country, niche, verification_status, onboarding_type, created_at")
      .order("created_at", { ascending: false }),
    admin
      .from("ai_visibility_scores")
      .select("client_id, score_total, calculated_at")
      .order("calculated_at", { ascending: false }),
    admin.from("subscriptions").select("client_id, status, setup_fee_paid, current_period_end"),
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

  return (
    <main style={{ padding: 60, maxWidth: 1000, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">← Volver</Link>
      </p>
      <h1>Todos los clientes ({clients?.length ?? 0})</h1>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #333" }}>
            <th style={{ padding: 6 }}>Negocio</th>
            <th style={{ padding: 6 }}>Plan</th>
            <th style={{ padding: 6 }}>País</th>
            <th style={{ padding: 6 }}>Nicho</th>
            <th style={{ padding: 6 }}>Verificación</th>
            <th style={{ padding: 6 }}>Score</th>
            <th style={{ padding: 6 }}>Suscripción</th>
          </tr>
        </thead>
        <tbody>
          {(clients ?? []).map((c) => {
            const sub = subByClient.get(c.id);
            const score = latestScoreByClient.get(c.id);
            return (
              <tr key={c.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 6 }}>{c.business_name}</td>
                <td style={{ padding: 6 }}>{c.plan}</td>
                <td style={{ padding: 6 }}>{c.country}</td>
                <td style={{ padding: 6 }}>{c.niche}</td>
                <td style={{ padding: 6, color: c.verification_status === "flagged" ? "crimson" : "inherit" }}>
                  {c.verification_status}
                </td>
                <td style={{ padding: 6 }}>{score !== undefined ? Math.round(score) : "—"}</td>
                <td style={{ padding: 6 }}>
                  {sub ? `${sub.status}${sub.setup_fee_paid ? " · setup pagado" : " · setup pendiente"}` : "sin suscripción"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
