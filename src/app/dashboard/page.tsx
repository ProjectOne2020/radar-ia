import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Panel } from "@/components/ui/panel";
import { ScoreRing } from "@/components/radar/score-ring";
import { PillarSignal, type PillarStatus } from "@/components/radar/pillar-signal";
import { ScoreTrend } from "@/components/radar/score-trend";
import { SetupOnboarding } from "@/components/dashboard/setup-onboarding";
import { OrganicMetrics } from "@/components/radar/organic-metrics";
import { computeBrandRecognition, computeTaoFromRuns } from "@/lib/metrics/tao";
import { loadCurrentSnapshot } from "@/lib/measurement/current-snapshot";
import { METHODOLOGY_VERSION } from "@/lib/measurement/versions";

// M16 — nombres de pilar por eje (local/e-commerce/apps): los pilares 2, 4 y 7 miden
// cosas distintas segun el eje (02-METODOLOGIA-SCORING.md).
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

// M7 — todo lo que se lee aqui usa el cliente server (RLS), no admin.
//
// P0.2-B — EL SCORE ACTUAL ES UNA SESION, NO UN PROMEDIO.
// Antes esta pagina traia TODOS los tracking_runs del cliente y calculaba la TAO en vivo
// sobre el historico completo — es decir, el promedio de por vida. Ahora lee el snapshot
// publicado y, si existe, su evidencia acotada a esa sesion.
export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");
  const tPillars = await getTranslations("Pillars");
  const tCommon = await getTranslations("Common");
  const supabase = await createClient();

  const [{ data: client }, { data: appListing }, { data: skuCatalog }, { data: location }, snapshot] =
    await Promise.all([
      supabase.from("clients").select("business_name, niche, plan, verification_status").single(),
      supabase.from("app_listings").select("id").maybeSingle(),
      supabase.from("sku_catalogs").select("id").maybeSingle(),
      supabase.from("locations").select("id").maybeSingle(),
      loadCurrentSnapshot(supabase),
    ]);

  // Evidencia del score mostrado: SOLO los canonicos de su sesion. Un snapshot legacy no
  // tiene sesion, asi que no hay metricas organicas que enseñar — y eso es correcto: no
  // existe forma demostrable de saber que runs lo produjeron.
  const { data: runs } = snapshot?.sessionId
    ? await supabase
        .from("tracking_runs")
        .select("prompt_id, mentioned, prompt_class, mention_method")
        .eq("session_id", snapshot.sessionId)
        .eq("is_canonical", true)
    : { data: null };

  const tao = computeTaoFromRuns(runs ?? []);
  const brand = computeBrandRecognition(runs ?? []);

  // Serie historica: solo la metodologia vigente. Una linea que cruza un cambio de
  // metodologia afirma visualmente una continuidad que no existe.
  const { data: history } = await supabase
    .from("ai_visibility_scores")
    .select("id, score_total, calculated_at")
    .eq("methodology_version", METHODOLOGY_VERSION)
    .in("publication_status", ["published", "superseded"])
    .order("calculated_at", { ascending: false });

  // M28 — un cliente self-serve (/registro) no tiene ninguna fila de eje hasta que
  // completa este paso.
  const hasAxisSetup = Boolean(appListing || skuCatalog || location);

  const axis = appListing ? "app" : skuCatalog ? "ecommerce" : "local";
  const pillarKeys = pillarKeysForAxis(axis);
  const businessName = client?.business_name ?? t("yourBusiness");

  const trendPoints =
    history
      ?.slice()
      .reverse()
      .map((s) => ({
        id: s.id,
        score: Number(s.score_total),
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

      {/* Decision del fundador: un score legacy se sigue mostrando, pero etiquetado y con
          aviso de que viene una medicion nueva. No se oculta lo que el cliente ya vio. */}
      {snapshot?.isLegacy && (
        <Panel className="mt-6 border-warning/40 bg-warning-soft">
          <p className="text-sm text-text-secondary">{t("legacyNotice")}</p>
        </Panel>
      )}

      {hasAxisSetup && (tao.samplePrompts > 0 || brand.sampleRuns > 0) && (
        <OrganicMetrics
          tao={tao}
          brand={brand}
          labels={{
            taoTitle: t("taoTitle"),
            taoHelp: t("taoHelp", { total: tao.samplePrompts, count: tao.promptsWithAppearance }),
            taoNone: t("taoNone"),
            brandTitle: t("brandTitle"),
            brandHelp: t("brandHelp", { total: brand.sampleRuns, count: brand.appearances }),
            brandNone: t("brandNone"),
            metricsNote: t("metricsNote"),
            appearances: t("appearances"),
            noAppearances: t("noAppearances"),
          }}
        />
      )}

      {!hasAxisSetup ? (
        <SetupOnboarding />
      ) : !snapshot ? (
        <Panel raised className="mt-8">
          <p className="text-text-secondary">{t("noScoreYet")}</p>
        </Panel>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <Panel raised>
            <ScoreRing
              score={snapshot.scoreTotal}
              noiseLabel={tCommon("noise")}
              signalLabel={tCommon("signal")}
            />

            {snapshot.coverageExpected !== null && snapshot.coverageSuccessful !== null && (
              <p className="mt-4 text-xs text-text-muted">
                {t("coverageNote", {
                  successful: snapshot.coverageSuccessful,
                  expected: snapshot.coverageExpected,
                })}
              </p>
            )}

            {trendPoints.length > 1 && (
              <div className="mt-8">
                <span className="font-mono text-xs uppercase tracking-wider text-text-muted">
                  {t("historyTitle", { count: trendPoints.length })}
                </span>
                <ScoreTrend points={trendPoints} className="mt-3" />
              </div>
            )}
          </Panel>

          <Panel raised>
            <h2 className="text-lg font-semibold text-ink">{t("breakdownTitle")}</h2>
            <div className="mt-2 divide-y divide-border border-t border-border">
              {Object.entries(snapshot.scoreByPillar).map(([pillar, info]) => (
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
