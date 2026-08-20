import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminShell } from "@/components/admin/admin-shell";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { TrendBarChart } from "@/components/admin/dist-bar-chart";

const SEVERITY_TONE = { critical: "critical", warning: "warning", info: "neutral" } as const;

export default async function AdminClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const admin = createAdminClient();

  const [{ data: client }, { data: scores }, { data: findings }, { data: sub }, { data: grant }] = await Promise.all(
    [
      admin
        .from("clients")
        .select(
          "id, business_name, plan, country, niche, verification_status, onboarding_type, email, phone_whatsapp, tax_id, public_listing_opt_in, created_at",
        )
        .eq("id", id)
        .maybeSingle(),
      admin
        .from("ai_visibility_scores")
        .select("id, score_total, calculated_at")
        .eq("client_id", id)
        .order("calculated_at", { ascending: false }),
      admin
        .from("audit_findings")
        .select("id, pillar, finding, severity, audited_at, detail_locked")
        .eq("client_id", id)
        .order("audited_at", { ascending: false })
        .limit(60),
      admin
        .from("subscriptions")
        .select("status, plan, setup_fee_paid, current_period_end, stripe_subscription_id")
        .eq("client_id", id)
        .maybeSingle(),
      admin.from("trial_grants").select("*").eq("client_id", id).maybeSingle(),
    ],
  );

  if (!client) notFound();

  const trendPoints = [...(scores ?? [])]
    .reverse()
    .map((s) => ({
      key: s.id,
      value: s.score_total,
      label: s.calculated_at ? new Date(s.calculated_at).toLocaleDateString("es") : "—",
    }));

  const latestFindingsByAudit = findings ?? [];

  return (
    <AdminShell
      title={client.business_name}
      actions={
        <Link href="/admin/clientes" className="text-sm text-text-secondary hover:text-ink">
          ← Volver a clientes
        </Link>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel raised className="flex flex-col gap-3 lg:col-span-1">
          <h2 className="font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
            Datos del cliente
          </h2>
          <dl className="flex flex-col gap-2 text-sm">
            <Row label="Plan"><span className="capitalize">{client.plan}</span></Row>
            <Row label="País">{client.country}</Row>
            <Row label="Nicho">{client.niche}</Row>
            <Row label="Tipo de alta">{client.onboarding_type}</Row>
            <Row label="Email">{client.email ?? "—"}</Row>
            <Row label="WhatsApp">{client.phone_whatsapp ?? "—"}</Row>
            <Row label="Tax ID">{client.tax_id ?? "—"}</Row>
            <Row label="Alta">{client.created_at ? new Date(client.created_at).toLocaleString("es") : "—"}</Row>
            <Row label="Verificación">
              <Badge tone={client.verification_status === "flagged" ? "critical" : "neutral"}>
                {client.verification_status}
              </Badge>
            </Row>
            <Row label="Listado público">
              <Badge tone={client.public_listing_opt_in ? "good" : "neutral"}>
                {client.public_listing_opt_in ? "autorizado" : "no autorizado (visible solo para admin)"}
              </Badge>
            </Row>
          </dl>
        </Panel>

        <Panel raised className="flex flex-col gap-3 lg:col-span-1">
          <h2 className="font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
            Suscripción
          </h2>
          {sub ? (
            <dl className="flex flex-col gap-2 text-sm">
              <Row label="Estado">
                <Badge tone={sub.status === "active" ? "good" : sub.status === "past_due" ? "warning" : "neutral"}>
                  {sub.status}
                </Badge>
              </Row>
              <Row label="Plan"><span className="capitalize">{sub.plan}</span></Row>
              <Row label="Setup pagado">{sub.setup_fee_paid ? "sí" : "no"}</Row>
              <Row label="Vence">
                {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("es") : "—"}
              </Row>
              <Row label="Stripe subscription">
                <span className="font-mono text-xs break-all">{sub.stripe_subscription_id ?? "—"}</span>
              </Row>
            </dl>
          ) : (
            <p className="text-sm text-text-muted">Sin suscripción.</p>
          )}
        </Panel>

        <Panel raised className="flex flex-col gap-3 lg:col-span-1">
          <h2 className="font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
            Trial gratuito (plan máximo)
          </h2>
          {grant ? (
            <dl className="flex flex-col gap-2 text-sm">
              <Row label="Estado">
                <Badge tone={grant.active ? "signal" : "neutral"}>{grant.active ? "activo" : "finalizado"}</Badge>
              </Row>
              <Row label="Plan otorgado"><span className="capitalize">{grant.granted_plan}</span></Row>
              <Row label="Auditorías restantes">{grant.audits_remaining}</Row>
              <Row label="Tenía suscripción previa">{grant.had_subscription ? "sí" : "no"}</Row>
              {grant.had_subscription && (
                <Row label="Plan original"><span className="capitalize">{grant.original_plan ?? "—"}</span></Row>
              )}
              <Row label="Otorgado">{new Date(grant.created_at).toLocaleString("es")}</Row>
            </dl>
          ) : (
            <p className="text-sm text-text-muted">Este cliente nunca tuvo un trial gratuito otorgado.</p>
          )}
        </Panel>
      </div>

      <Panel raised className="mt-4">
        <h2 className="mb-4 font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
          Historial de score ({scores?.length ?? 0} mediciones)
        </h2>
        {trendPoints.length > 0 ? (
          <TrendBarChart points={trendPoints} />
        ) : (
          <p className="text-sm text-text-muted">Sin mediciones todavía.</p>
        )}
      </Panel>

      <Panel raised className="mt-4">
        <h2 className="mb-4 font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
          Hallazgos recientes ({latestFindingsByAudit.length})
        </h2>
        {latestFindingsByAudit.length === 0 ? (
          <p className="text-sm text-text-muted">Sin hallazgos registrados.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {latestFindingsByAudit.map((f) => {
              const severity = (f.severity ?? "info") as keyof typeof SEVERITY_TONE;
              return (
                <li key={f.id} className="flex items-start gap-3 rounded-xs border border-border bg-paper-raised p-3.5">
                  <Badge tone={SEVERITY_TONE[severity] ?? "neutral"} className="mt-0.5 shrink-0">
                    Pilar {f.pillar}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-text">{f.finding}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      {f.audited_at ? new Date(f.audited_at).toLocaleString("es") : "—"}
                      {f.detail_locked ? " · detalle bloqueado (free tier)" : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </AdminShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-b-0 last:pb-0">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </div>
  );
}
