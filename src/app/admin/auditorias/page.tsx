import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";

const LIMIT = 200;

export default async function AdminAuditoriasPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: scores, count } = await admin
    .from("ai_visibility_scores")
    .select("id, client_id, score_total, calculated_at", { count: "exact" })
    .order("calculated_at", { ascending: false })
    .limit(LIMIT);

  const clientIds = Array.from(new Set((scores ?? []).map((s) => s.client_id).filter(Boolean))) as string[];
  const { data: clients } =
    clientIds.length > 0
      ? await admin.from("clients").select("id, business_name, plan, verification_status").in("id", clientIds)
      : { data: [] };

  const clientById = new Map((clients ?? []).map((c) => [c.id, c]));

  return (
    <AdminShell title={`Auditorías (${count ?? scores?.length ?? 0} total, mostrando últimas ${LIMIT})`}>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[700px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-strong bg-paper-raised text-left text-xs tracking-wide text-text-secondary uppercase">
              <th className="px-4 py-3 font-medium">Negocio</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Verificación</th>
            </tr>
          </thead>
          <tbody>
            {(scores ?? []).map((s) => {
              const client = s.client_id ? clientById.get(s.client_id) : undefined;
              return (
                <tr key={s.id} className="border-b border-border last:border-b-0 hover:bg-surface">
                  <td className="px-4 py-3">
                    {client && s.client_id ? (
                      <Link
                        href={`/admin/clientes/${s.client_id}`}
                        className="font-medium text-ink hover:text-signal-strong"
                      >
                        {client.business_name}
                      </Link>
                    ) : (
                      <span className="text-text-muted">cliente eliminado</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-secondary capitalize">{client?.plan ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-ink">{Math.round(s.score_total)}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {s.calculated_at ? new Date(s.calculated_at).toLocaleString("es") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {client && (
                      <Badge tone={client.verification_status === "flagged" ? "critical" : "neutral"}>
                        {client.verification_status}
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(scores ?? []).length === 0 && <p className="mt-4 text-sm text-text-muted">Sin auditorías todavía.</p>}
    </AdminShell>
  );
}
