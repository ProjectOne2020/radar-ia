import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";

const PILLAR_KEYS: Record<number, string> = {
  1: "1",
  2: "2_local",
  3: "3",
  4: "4_local",
  5: "5",
  6: "6",
  7: "7_local",
  8: "8",
};

const SEVERITY_ORDER = ["critical", "warning", "info"] as const;
const SEVERITY_TONE = { critical: "critical", warning: "warning", info: "neutral" } as const;

// M7 — a diferencia de M6 (auditoria gratis), aqui NO se filtra por detail_locked. La
// policy audit_findings_select_own de M1 ya devuelve todo lo del propio cliente, incluido
// el detalle accionable — es exactamente lo que un cliente pagado debe ver.
export default async function HallazgosPage() {
  const t = await getTranslations("DashboardHallazgos");
  const tPillars = await getTranslations("Pillars");
  const tCommon = await getTranslations("Common");
  const supabase = await createClient();

  const { data: findings } = await supabase
    .from("audit_findings")
    .select("pillar, finding, severity, detail_locked, audited_at")
    .order("pillar", { ascending: true });

  const byPillar = new Map<number, NonNullable<typeof findings>>();
  for (const f of findings ?? []) {
    if (!byPillar.has(f.pillar)) byPillar.set(f.pillar, []);
    byPillar.get(f.pillar)!.push(f);
  }

  const severityLabel = {
    critical: tCommon("severityCritical"),
    warning: tCommon("severityWarning"),
    info: tCommon("severityInfo"),
  } as const;

  return (
    <>
      <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>
      <p className="mt-2 text-text-secondary">{t("subtitle")}</p>

      <div className="mt-8 flex flex-col gap-8">
        {[...byPillar.entries()].map(([pillar, list]) => {
          const sorted = [...list].sort(
            (a, b) =>
              SEVERITY_ORDER.indexOf((a.severity ?? "info") as (typeof SEVERITY_ORDER)[number]) -
              SEVERITY_ORDER.indexOf((b.severity ?? "info") as (typeof SEVERITY_ORDER)[number]),
          );
          return (
            <section key={pillar}>
              <h2 className="text-lg font-semibold text-ink">
                {tPillars(PILLAR_KEYS[pillar] ?? "fallback", { n: pillar })}
              </h2>
              <ul className="mt-3 flex flex-col gap-2.5">
                {sorted.map((f, i) => {
                  const severity = (f.severity ?? "info") as keyof typeof SEVERITY_TONE;
                  return (
                    <li
                      key={i}
                      className="flex items-start gap-3 rounded-xs border border-border bg-paper-raised p-3.5"
                    >
                      <Badge tone={SEVERITY_TONE[severity] ?? "neutral"} className="mt-0.5 shrink-0">
                        {severityLabel[severity] ?? f.severity}
                      </Badge>
                      <span className="text-sm leading-relaxed text-text">{f.finding}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {(!findings || findings.length === 0) && (
        <Panel raised className="mt-8">
          <p className="text-text-secondary">{t("empty")}</p>
        </Panel>
      )}
    </>
  );
}
