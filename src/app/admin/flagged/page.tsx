import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminShell } from "@/components/admin/admin-shell";
import { Panel } from "@/components/ui/panel";
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
    <AdminShell title={`Cuentas marcadas por anti-abuso (${flagged?.length ?? 0})`}>
      {(flagged ?? []).length === 0 && <p className="text-sm text-text-muted">No hay cuentas marcadas.</p>}

      <div className="flex flex-col gap-3">
        {(flagged ?? []).map((c) => (
          <Panel key={c.id}>
            <p className="text-ink">
              <span className="font-medium">{c.business_name}</span>
              <span className="text-text-secondary"> · {c.country}</span>
            </p>
            <p className="mt-1 text-xs text-text-muted">
              WhatsApp: {c.phone_whatsapp} · Tax ID: {c.tax_id ?? "—"}
            </p>
            <FlaggedActions clientId={c.id} />
          </Panel>
        ))}
      </div>
    </AdminShell>
  );
}
