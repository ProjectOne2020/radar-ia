import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Panel } from "@/components/ui/panel";
import { ScoreRing } from "@/components/radar/score-ring";
import { PillarSignal, type PillarStatus } from "@/components/radar/pillar-signal";
import { ScoreTrend } from "@/components/radar/score-trend";

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

function pillarStatus(measured: boolean, subscore: number): PillarStatus {
  if (!measured) return "unmeasured";
  if (subscore >= 70) return "good";
  if (subscore >= 40) return "warning";
  return "critical";
}

// M7 — todo lo que se lee aqui usa el cliente server (RLS), no admin: si esta pagina
// muestra datos, es la prueba viva de que la sesion quedo enlazada a client_id (M1 + M5).
export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");
  const tPillars = await getTranslations("Pillars");
  const tCommon = await getTranslations("Common");
  const supabase = await createClient();

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
  const businessName = client?.business_name ?? t("yourBusiness");

  const trendPoints =
    scoreHistory
      ?.slice()
      .reverse()
      .map((s) => ({
        id: s.id,
        score: s.score_total,
        date: s.calculated_at ? new Date(s.calculated_at).toLocaleDateString() : "—",
      })) ?? [];

  return (
    <>
      <h1 className="text-2xl sm:text-3xl">{businessName}</h1>
      <p className="mt-1 text-sm text-text-secondary">
        {t("planLabel", {
          plan: client?.plan ?? "",
          niche: client?.niche ?? "",
          status: client?.verification_status ?? "",
        })}
      </p>

      {!scoreHistory || scoreHistory.length === 0 ? (
        <Panel raised className="mt-8">
          <p className="text-text-secondary">{t("noScoreYet")}</p>
        </Panel>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <Panel raised>
            <ScoreRing
              score={latest!.score_total}
              noiseLabel={tCommon("noise")}
              signalLabel={tCommon("signal")}
            />

            {trendPoints.length > 1 && (
              <div className="mt-8">
                <span className="font-mono text-xs uppercase tracking-wider text-text-muted">
                  {t("historyTitle", { count: scoreHistory.length })}
                </span>
                <ScoreTrend points={trendPoints} className="mt-3" />
              </div>
            )}
          </Panel>

          <Panel raised>
            <h2 className="text-lg font-semibold text-ink">{t("breakdownTitle")}</h2>
            <div className="mt-2 divide-y divide-border border-t border-border">
              {Object.entries(
                (latest!.score_by_pillar as Record<string, { subscore: number; measured: boolean; weight_pct?: number }>) ?? {},
              ).map(([pillar, info]) => (
                <PillarSignal
                  key={pillar}
                  name={tPillars(pillarKeys[pillar] ?? "fallback", { n: pillar })}
                  weight={info.weight_pct ?? 0}
                  status={pillarStatus(info.measured, info.subscore)}
                  value={info.measured ? info.subscore : undefined}
                  notMeasuredLabel={t("notMeasured")}
                />
              ))}
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
