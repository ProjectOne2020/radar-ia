import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import FlaggedActions from "./flagged-actions";

export default async function AdminFlaggedPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: flagged } = await admin
    .from("clients")
    .select("id, business_name, phone_whatsapp, tax_id, country, created_at")
    .eq("verification_status", "flagged")
    .order("created_at", { ascending: false });

  return (
    <main style={{ padding: 60, maxWidth: 800, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">← Volver</Link>
      </p>
      <h1>Cuentas marcadas por anti-abuso ({flagged?.length ?? 0})</h1>

      {(flagged ?? []).length === 0 && <p>No hay cuentas marcadas.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(flagged ?? []).map((c) => (
          <div key={c.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            <p>
              <strong>{c.business_name}</strong> · {c.country}
            </p>
            <p style={{ fontSize: 12, color: "#666" }}>
              WhatsApp: {c.phone_whatsapp} · Tax ID: {c.tax_id ?? "—"}
            </p>
            <FlaggedActions clientId={c.id} />
          </div>
        ))}
      </div>
    </main>
  );
}
