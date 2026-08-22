import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { computeTaoFromRuns } from "@/lib/metrics/tao";
import { PILLAR_WEIGHTS } from "./weights";
import {
  scorePillar1Nap,
  scorePillar2Gbp,
  scorePillar2Merchant,
  scorePillar2AppStore,
  scorePillar3Crawlability,
  scorePillar4Semantic,
  scorePillar4Ecommerce,
  scorePillar4App,
  scorePillar5QuestionCoverage,
  scorePillar7Reputation,
  scorePillar7AppRating,
  type PillarScore,
} from "./pillar-scorers";

export interface CalculateScoreOptions {
  // M14 — por defecto se autodetecta via presencia de una fila en sku_catalogs (misma
  // senal que ya usa run-audit.ts para decidir si corre el flujo GBP o Merchant Center).
  // El parametro sigue existiendo como override explicito para pruebas.
  isEcommerce?: boolean;
  // M16 — igual que isEcommerce, autodetectado via app_listings. Si un cliente tuviera
  // ambas filas (sku_catalogs y app_listings), el eje app tiene precedencia — ver
  // run-audit.ts para la misma regla aplicada a que auditoria corre.
  isApp?: boolean;
}

interface PillarEntry extends PillarScore {
  weight_pct: number;
  contribution: number;
}

export interface ScoreResult {
  scoreId: string;
  clientId: string;
  scoreTotal: number;
  scoreByPillar: Record<string, PillarEntry>;
  unmeasuredPillars: number[];
}

// M4 — calcula el AI Visibility Score 0-100 a partir de audit_findings (pilares 1-5, 7)
// y tracking_runs/citations (pilares 6 y 8), aplica los pesos exactos de
// 02-METODOLOGIA-SCORING.md, e inserta una fila nueva (historico) en ai_visibility_scores.
//
// Pilares sin datos suficientes cuentan como 0 en score_total (decision del fundador) pero
// quedan marcados measured:false en score_by_pillar — el score nunca debe presentarse como
// una medicion completa cuando algun pilar esta sin medir; eso lo debe reflejar el
// dashboard/reporte (M7/M10), no esconderlo detras de un numero.
export async function calculateScoreForClient(
  clientId: string,
  options: CalculateScoreOptions = {}
): Promise<ScoreResult> {
  const admin = createAdminClient();

  const [
    { data: findings, error: findingsError },
    { data: trackingRuns, error: trackingError },
    { data: skuCatalog, error: skuCatalogError },
    { data: appListing, error: appListingError },
  ] = await Promise.all([
    admin.from("audit_findings").select("pillar, finding, severity").eq("client_id", clientId),
    // P0.1 — se traen tambien prompt_class y mention_method: sin ellos el pilar 8 no puede
    // distinguir una medicion limpia de una contaminada.
    // TODO(P0.2): esta consulta sigue leyendo TODO el historico sin ventana temporal y sin
    // .limit(), asi que arrastra el promedio de por vida y el tope de 1000 filas de
    // PostgREST. Corregirlo es P0.2 (measurement_sessions), no P0.1.
    admin
      .from("tracking_runs")
      .select("id, mentioned, prompt_class, prompt_id, mention_method, citations(is_directory)")
      .eq("client_id", clientId),
    admin.from("sku_catalogs").select("id").eq("client_id", clientId).maybeSingle(),
    admin.from("app_listings").select("id").eq("client_id", clientId).maybeSingle(),
  ]);

  if (findingsError) {
    throw new Error(`No se pudieron leer audit_findings de ${clientId}: ${findingsError.message}`);
  }
  if (trackingError) {
    throw new Error(`No se pudieron leer tracking_runs de ${clientId}: ${trackingError.message}`);
  }
  if (skuCatalogError) {
    throw new Error(`No se pudo leer sku_catalogs de ${clientId}: ${skuCatalogError.message}`);
  }
  if (appListingError) {
    throw new Error(`No se pudo leer app_listings de ${clientId}: ${appListingError.message}`);
  }

  const isApp = options.isApp ?? !!appListing;
  const isEcommerce = !isApp && (options.isEcommerce ?? !!skuCatalog);

  const byPillar = (pillar: number) => (findings ?? []).filter((f) => f.pillar === pillar);

  // Pilares 2, 4 y 7 son los que 02-METODOLOGIA-SCORING.md sustituye segun el eje del
  // cliente (local/e-commerce/apps) — los pesos (PILLAR_WEIGHTS) son identicos en los 3.
  const pillarScores: Record<number, PillarScore> = {
    1: scorePillar1Nap(byPillar(1)),
    2: isApp ? scorePillar2AppStore(byPillar(2)) : isEcommerce ? scorePillar2Merchant(byPillar(2)) : scorePillar2Gbp(byPillar(2)),
    3: scorePillar3Crawlability(byPillar(3)),
    4: isApp ? scorePillar4App(byPillar(4)) : isEcommerce ? scorePillar4Ecommerce(byPillar(4)) : scorePillar4Semantic(byPillar(4)),
    5: scorePillar5QuestionCoverage(byPillar(5)),
    6: scorePillar6ExternalCitations(trackingRuns ?? []),
    7: isApp ? scorePillar7AppRating(byPillar(7)) : scorePillar7Reputation(byPillar(7)),
    8: scorePillar8Tao(trackingRuns ?? []),
  };

  const scoreByPillar: Record<string, PillarEntry> = {};
  let scoreTotal = 0;
  const unmeasuredPillars: number[] = [];

  for (const [pillarStr, weightPct] of Object.entries(PILLAR_WEIGHTS)) {
    const pillar = Number(pillarStr);
    const { subscore, measured } = pillarScores[pillar];
    // Pilar sin medir cuenta como 0 en el total, pero queda marcado — nunca se infla el
    // score con lo desconocido (decision explicita del fundador).
    const contribution = measured ? (subscore / 100) * weightPct : 0;

    scoreByPillar[pillarStr] = { subscore: round2(subscore), measured, weight_pct: weightPct, contribution: round2(contribution) };
    scoreTotal += contribution;
    if (!measured) unmeasuredPillars.push(pillar);
  }

  const { data: inserted, error: insertError } = await admin
    .from("ai_visibility_scores")
    .insert({
      client_id: clientId,
      score_total: round2(scoreTotal),
      score_by_pillar: scoreByPillar as unknown as Json,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    throw new Error(`No se pudo insertar ai_visibility_scores: ${insertError?.message}`);
  }

  // P0.2-A — AQUI NO SE CONSUME NADA, A PROPOSITO.
  //
  // Hasta P0.2-A esta funcion llamaba a consumeTrialAuditIfActive(), asi que CUALQUIER
  // calculo de score descontaba una auditoria del trial: recalcular para depurar,
  // recalcular tras un cambio de metodologia, o un POST de prueba a /api/score cobraban
  // igual que una auditoria real. Una funcion de calculo no puede tener efectos
  // comerciales.
  //
  // El consumo ahora lo decide el orquestador, que es el unico que sabe POR QUE se midio:
  // ver consumeTrialAuditForMeasurement() en @/lib/admin/trial-policy.
  //
  // NO reintroducir la llamada aqui.

  return {
    scoreId: inserted.id,
    clientId,
    scoreTotal: round2(scoreTotal),
    scoreByPillar,
    unmeasuredPillars,
  };
}

interface TrackingRunWithCitations {
  id: string;
  mentioned: boolean;
  prompt_id?: string | null;
  prompt_class?: string | null;
  mention_method?: string | null;
  citations: Array<{ is_directory: boolean | null }> | null;
}

// Pilar 6 — Citas y autoridad externa (15%). No viene de audit_findings: la señal real
// que tenemos es si las citas que los motores de IA ya devolvieron (M2) apuntan a
// directorios (citations.is_directory, cruzado contra directory_sources). Es el dato mas
// directo disponible — mas fiel que inventar un auditor de directorios aparte.
function scorePillar6ExternalCitations(trackingRuns: TrackingRunWithCitations[]): PillarScore {
  if (trackingRuns.length === 0) return { subscore: 0, measured: false };

  const runsWithDirectoryCitation = trackingRuns.filter((run) =>
    (run.citations ?? []).some((c) => c.is_directory === true)
  ).length;

  return { subscore: (runsWithDirectoryCitation / trackingRuns.length) * 100, measured: true };
}

// Pilar 8 — Tasa de Aparicion Organica (TAO), 13%. El ancla del score a la realidad.
//
// P0.1 — CAMBIO DE SIGNIFICADO. Antes este pilar promediaba TODAS las menciones, incluidas
// las de preguntas que llevaban el nombre del negocio dentro del prompt. Con datos reales
// de produccion eso daba 94.4% de mencion en preguntas con nombre contra 0.0% en preguntas
// ciegas para el MISMO negocio: el pilar medía mayormente el diseño de nuestras preguntas,
// no la visibilidad del cliente.
//
// Ahora solo entran runs `clean_blind` con clasificacion no degradada. La compuerta vive
// en toTaoObservation() y es imposible de saltar por tipos (ver src/lib/metrics/tao.ts).
//
// Consecuencia esperada y correcta: los scores publicados BAJAN. El numero anterior era
// artefactual.
function scorePillar8Tao(trackingRuns: TrackingRunWithCitations[]): PillarScore {
  const tao = computeTaoFromRuns(
    trackingRuns.map((r) => ({
      prompt_id: r.prompt_id ?? null,
      mentioned: r.mentioned,
      prompt_class: r.prompt_class ?? null,
      mention_method: r.mention_method ?? null,
    })),
  );

  // Sin muestra admisible el pilar queda SIN MEDIR — nunca 0. Un cliente cuyas preguntas
  // estan todas contaminadas no "tiene visibilidad cero": es que todavia no lo medimos
  // bien. Confundir ambas cosas es exactamente el error que P0.1 corrige.
  if (tao.rate === null) return { subscore: 0, measured: false };

  return { subscore: tao.rate, measured: true };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
