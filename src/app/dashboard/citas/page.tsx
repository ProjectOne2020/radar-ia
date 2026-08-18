import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

// M7 — lista de citations con distincion dominio propio vs. directorio. La policy
// citations_select_own de M1 ya filtra por tracking_runs.client_id, no hace falta filtro
// adicional aqui.
export default async function CitasPage() {
  const t = await getTranslations("DashboardCitas");
  const tCommon = await getTranslations("Common");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: runs } = await supabase
    .from("tracking_runs")
    .select("id, engine, mentioned, run_at, citations(cited_url, cited_domain, is_client_domain, is_directory)")
    .order("run_at", { ascending: false });

  return (
    <main style={{ padding: 60, maxWidth: 720, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/dashboard">{tCommon("back")}</Link>
      </p>
      <h1>{t("title")}</h1>

      {(runs ?? []).map((run) => (
        <section key={run.id} style={{ marginTop: 16, borderTop: "1px solid #ddd", paddingTop: 8 }}>
          <p>
            <strong>{run.engine}</strong> · {run.mentioned ? t("mentioned") : t("notMentioned")} ·{" "}
            {run.run_at ? new Date(run.run_at).toLocaleString() : ""}
          </p>
          {run.citations && run.citations.length > 0 ? (
            <ul>
              {run.citations.map((c, i) => (
                <li key={i}>
                  {c.cited_domain}{" "}
                  {c.is_client_domain && <span style={{ color: "green" }}>{t("yourSite")}</span>}
                  {c.is_directory && <span style={{ color: "#3c78d8" }}>{t("directory")}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: "#666" }}>{t("noCitationsInRun")}</p>
          )}
        </section>
      ))}

      {(!runs || runs.length === 0) && <p>{t("empty")}</p>}
    </main>
  );
}
