import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

// M7 — lista de citations con distincion dominio propio vs. directorio. La policy
// citations_select_own de M1 ya filtra por tracking_runs.client_id, no hace falta filtro
// adicional aqui. Cada corrida se presenta como un resultado de motor verificable
// (engine + timestamp + evidencia), no como una tabla plana.
export default async function CitasPage() {
  const t = await getTranslations("DashboardCitas");
  const supabase = await createClient();

  const { data: runs } = await supabase
    .from("tracking_runs")
    .select(
      "id, engine, mentioned, run_at, prompt_sets(prompt_text), citations(cited_url, cited_domain, is_client_domain, is_directory)",
    )
    .order("run_at", { ascending: false });

  return (
    <>
      <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>

      <div className="mt-8 flex flex-col gap-4">
        {(runs ?? []).map((run) => (
          <Panel key={run.id} raised>
            {run.prompt_sets?.prompt_text && (
              <p className="font-display text-[1.05rem] italic leading-snug text-ink">
                “{run.prompt_sets.prompt_text}”
              </p>
            )}
            <div
              className={cn(
                "flex flex-wrap items-center justify-between gap-2",
                run.prompt_sets?.prompt_text && "mt-3",
              )}
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-sm font-semibold uppercase tracking-wide text-ink">
                  {run.engine}
                </span>
                <Badge tone={run.mentioned ? "good" : "critical"}>
                  {run.mentioned ? t("mentioned") : t("notMentioned")}
                </Badge>
              </div>
              <span className="font-mono text-xs text-text-muted">
                {run.run_at ? new Date(run.run_at).toLocaleString() : ""}
              </span>
            </div>

            {run.citations && run.citations.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                {run.citations.map((c, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 text-sm text-text">
                    <span>{c.cited_domain}</span>
                    {c.is_client_domain && <Badge tone="signal">{t("yourSite")}</Badge>}
                    {c.is_directory && <Badge tone="observed">{t("directory")}</Badge>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 border-t border-border pt-4 text-sm text-text-muted">
                {t("noCitationsInRun")}
              </p>
            )}
          </Panel>
        ))}
      </div>

      {(!runs || runs.length === 0) && (
        <Panel raised className="mt-8">
          <p className="text-text-secondary">{t("empty")}</p>
        </Panel>
      )}
    </>
  );
}
