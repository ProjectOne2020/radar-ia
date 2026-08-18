import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

// M16 — nombres de pilar por eje (local/e-commerce/apps): los pilares 2, 4 y 7 miden
// cosas distintas segun el eje (02-METODOLOGIA-SCORING.md) — mostrar "Google Business
// Profile" para un cliente de app o e-commerce es incorrecto, no solo generico.
const PILLAR_KEYS_BASE: Record<string, string> = {
  "1": "1",
  "3": "3",
  "5": "5",
  "6": "6",
  "8": "8",
};

function pillarKeysForAxis(axis: "local" | "ecommerce" | "app"): Record<string, string> {
  return {
    ...PILLAR_KEYS_BASE,
    "2": `2_${axis}`,
    "4": `4_${axis}`,
    "7": `7_${axis}`,
  };
}

// M7 — todo lo que se lee aqui usa el cliente server (RLS), no admin: si esta pagina
// muestra datos, es la prueba viva de que la sesion quedo enlazada a client_id (M1 + M5).
export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");
  const tPillars = await getTranslations("Pillars");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: client }, { data: scoreHistory }, { data: appListing }, { data: skuCatalog }] = await Promise.all([
    supabase.from("clients").select("business_name, niche, plan, verification_status").single(),
    supabase
      .from("ai_visibility_scores")
      .select("id, score_total, score_by_pillar, calculated_at")
      .order("calculated_at", { ascending: false }),
    supabase.from("app_listings").select("id").maybeSingle(),
    supabase.from("sku_catalogs").select("id").maybeSingle(),
  ]);

  const latest = scoreHistory?.[0];
  const axis = appListing ? "app" : skuCatalog ? "ecommerce" : "local";
  const pillarKeys = pillarKeysForAxis(axis);

  return (
    <main style={{ padding: 60, maxWidth: 720, fontFamily: "sans-serif" }}>
      <h1>{client?.business_name ?? t("yourBusiness")}</h1>
      <p>
        {t("planLabel", {
          plan: client?.plan ?? "",
          niche: client?.niche ?? "",
          status: client?.verification_status ?? "",
        })}
      </p>

      <nav style={{ display: "flex", gap: 16, margin: "16px 0" }}>
        <Link href="/dashboard/hallazgos">{t("navFindings")}</Link>
        <Link href="/dashboard/citas">{t("navCitations")}</Link>
        <Link href="/dashboard/competidores">{t("navCompetitors")}</Link>
        <Link href="/dashboard/catalogo">{t("navCatalog")}</Link>
        <Link href="/dashboard/app">{t("navApp")}</Link>
      </nav>

      {!scoreHistory || scoreHistory.length === 0 ? (
        <p>{t("noScoreYet")}</p>
      ) : (
        <>
          <h2>{t("currentScore", { score: Math.round(latest!.score_total) })}</h2>

          <h3>{t("breakdownTitle")}</h3>
          <ul>
            {Object.entries((latest!.score_by_pillar as Record<string, { subscore: number; measured: boolean }>) ?? {}).map(
              ([pillar, info]) => (
                <li key={pillar}>
                  {tPillars(pillarKeys[pillar] ?? "fallback", { n: pillar })}:{" "}
                  {info.measured ? `${Math.round(info.subscore)}/100` : t("notMeasured")}
                </li>
              )
            )}
          </ul>

          <h3>{t("historyTitle", { count: scoreHistory.length })}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {scoreHistory.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 160, fontSize: 12, color: "#666" }}>
                  {s.calculated_at ? new Date(s.calculated_at).toLocaleString() : "—"}
                </span>
                <div style={{ background: "#eee", width: 200, height: 12 }}>
                  <div style={{ background: "#3c78d8", width: `${s.score_total}%`, height: 12 }} />
                </div>
                <span>{Math.round(s.score_total)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
