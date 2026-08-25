import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { computeTaoFromRuns } from "@/lib/metrics/tao";
import { METHODOLOGY_VERSION, SCORING_VERSION, CLASSIFIER_VERSION, currentCodeSha } from "@/lib/measurement/versions";
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
  isEcommerce?: boolean;
  isApp?: boolean;
}

interface PillarEntry extends PillarScore {
  weight_pct: number;
  contribution: number;
}

export type Comparability = "comparable" | "comparable_with_caveat" | "not_comparable";

export interface ScoreResult {
  scoreId: string;
  sessionId: string;
  clientId: string;
  scoreTotal: number;
  scoreByPillar: Record<string, PillarEntry>;
  unmeasuredPillars: number[];
  coverageExpected: number;
  coverageSuccessful: number;
  publicationStatus: "published" | "withheld";
  comparability: Comparability | null;
  deltaTotal: number | null;
}

// M4 — AI Visibility Score 0-100 con los pesos exactos de 02-METODOLOGIA-SCORING.md.
//
// ===========================================================================
// P0.2-B — EL SCORE DEPENDE DE UNA SESION, NO DEL HISTORICO
// ===========================================================================
// Antes esta funcion recibia un clientId y leia `where client_id = X` sobre TODO el
// historico, sin ventana ni limite. Eso se comprobo en produccion con aritmetica exacta:
// el mismo negocio, el mismo dia, 17 minutos despues, paso de 18.93 a 18.14 — porque el
// pool de runs crecio de 15 a 36. El numero no medía al cliente, medía cuantas veces lo
// habiamos medido.
//
// Ahora recibe un sessionId y las DOS fuentes estan ancladas a el:
//   FINDINGS  = audit_findings  where session_id  -> pilares 1,2,3,4,5,7  (72% del peso)
//   CANONICOS = tracking_runs   where session_id and is_canonical -> pilares 6 y 8 (28%)
//
// Los datos legacy (session_id NULL) son INALCANZABLES por construccion: `where session_id
// = $1` no puede devolver un NULL. No es un filtro que alguien deba recordar poner.
//
// Es idempotente: recalcular la misma sesion produce el mismo snapshot (upsert por
// session_id), lo que hace el score reproducible y hace que "recalcular" no sea un evento
// facturable ni un riesgo.
//
// P0.2-A — AQUI NO SE CONSUME TRIAL, A PROPOSITO. Esta funcion es pura respecto del trial:
// el consumo lo decide el orquestador via trial-policy.ts. NO reintroducir la llamada aqui.
// ===========================================================================
export async function calculateScoreForSession(
  sessionId: string,
  options: CalculateScoreOptions = {},
): Promise<ScoreResult> {
  const admin = createAdminClient();

  const { data: session, error: sessionError } = await admin
    .from("measurement_sessions")
    .select(
      "id, client_id, expected_runs, execution_status, engine_set, prompt_set_hash, methodology_version, scoring_version, classifier_version",
    )
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    throw new Error(`No se encontro la sesion ${sessionId}: ${sessionError?.message ?? "not found"}`);
  }

  const clientId = session.client_id;

  const [
    { data: findings, error: findingsError },
    { data: canonicalRuns, error: runsError },
    { data: skuCatalog, error: skuCatalogError },
    { data: appListing, error: appListingError },
  ] = await Promise.all([
    // Pilares 1-5 y 7. Ventana de sesion: los hallazgos de otra auditoria son inalcanzables.
    admin.from("audit_findings").select("pillar, finding, severity").eq("session_id", sessionId),
    // Pilares 6 y 8. UNA SOLA consulta para ambos: dejan de medir poblaciones distintas.
    admin
      .from("tracking_runs")
      .select("id, mentioned, prompt_class, prompt_id, mention_method, citations(is_directory)")
      .eq("session_id", sessionId)
      .eq("is_canonical", true),
    admin.from("sku_catalogs").select("id").eq("client_id", clientId).maybeSingle(),
    admin.from("app_listings").select("id").eq("client_id", clientId).maybeSingle(),
  ]);

  if (findingsError) throw new Error(`No se pudieron leer audit_findings de ${sessionId}: ${findingsError.message}`);
  if (runsError) throw new Error(`No se pudieron leer tracking_runs de ${sessionId}: ${runsError.message}`);
  if (skuCatalogError) throw new Error(`No se pudo leer sku_catalogs de ${clientId}: ${skuCatalogError.message}`);
  if (appListingError) throw new Error(`No se pudo leer app_listings de ${clientId}: ${appListingError.message}`);

  const runs = canonicalRuns ?? [];

  const isApp = options.isApp ?? !!appListing;
  const isEcommerce = !isApp && (options.isEcommerce ?? !!skuCatalog);

  const byPillar = (pillar: number) => (findings ?? []).filter((f) => f.pillar === pillar);

  const pillarScores: Record<number, PillarScore> = {
    1: scorePillar1Nap(byPillar(1)),
    2: isApp ? scorePillar2AppStore(byPillar(2)) : isEcommerce ? scorePillar2Merchant(byPillar(2)) : scorePillar2Gbp(byPillar(2)),
    3: scorePillar3Crawlability(byPillar(3)),
    4: isApp ? scorePillar4App(byPillar(4)) : isEcommerce ? scorePillar4Ecommerce(byPillar(4)) : scorePillar4Semantic(byPillar(4)),
    5: scorePillar5QuestionCoverage(byPillar(5)),
    // Pilares 6 y 8 reciben EXACTAMENTE el mismo array de canonicos.
    6: scorePillar6ExternalCitations(runs),
    7: isApp ? scorePillar7AppRating(byPillar(7)) : scorePillar7Reputation(byPillar(7)),
    8: scorePillar8Tao(runs),
  };

  const scoreByPillar: Record<string, PillarEntry> = {};
  let scoreTotal = 0;
  const unmeasuredPillars: number[] = [];

  for (const [pillarStr, weightPct] of Object.entries(PILLAR_WEIGHTS)) {
    const pillar = Number(pillarStr);
    const { subscore, measured } = pillarScores[pillar];
    const contribution = measured ? (subscore / 100) * weightPct : 0;

    scoreByPillar[pillarStr] = { subscore: round2(subscore), measured, weight_pct: weightPct, contribution: round2(contribution) };
    scoreTotal += contribution;
    if (!measured) unmeasuredPillars.push(pillar);
  }

  // Solo una sesion 'completed' publica (decision del fundador). El CHECK de la tabla lo
  // impone tambien en la base: no depende de que este codigo lo recuerde.
  const publicationStatus = session.execution_status === "completed" ? "published" : "withheld";

  const comparison = await compareWithPrevious(admin, {
    clientId,
    sessionId,
    methodologyVersion: session.methodology_version,
    promptSetHash: session.prompt_set_hash,
    engineSet: session.engine_set,
    scoreTotal,
  });

  const { data: inserted, error: insertError } = await admin
    .from("ai_visibility_scores")
    .upsert(
      {
        client_id: clientId,
        session_id: sessionId,
        score_total: round2(scoreTotal),
        score_by_pillar: scoreByPillar as unknown as Json,
        coverage_expected: session.expected_runs,
        coverage_successful: runs.length,
        methodology_version: METHODOLOGY_VERSION,
        scoring_version: SCORING_VERSION,
        classifier_version: CLASSIFIER_VERSION,
        code_sha: currentCodeSha(),
        publication_status: publicationStatus,
        previous_snapshot_id: comparison.previousSnapshotId,
        delta_total: comparison.deltaTotal,
        comparability: comparison.comparability,
      },
      { onConflict: "session_id" },
    )
    .select("id")
    .single();

  if (insertError || !inserted) {
    throw new Error(`No se pudo insertar el snapshot de score: ${insertError?.message}`);
  }

  // El snapshot anterior publicado pasa a superseded. Nunca se borra: el historico es
  // evidencia, y "retirar" es marcar, no eliminar.
  if (publicationStatus === "published" && comparison.previousSnapshotId) {
    await admin
      .from("ai_visibility_scores")
      .update({ publication_status: "superseded" })
      .eq("id", comparison.previousSnapshotId);
  }

  return {
    scoreId: inserted.id,
    sessionId,
    clientId,
    scoreTotal: round2(scoreTotal),
    scoreByPillar,
    unmeasuredPillars,
    coverageExpected: session.expected_runs,
    coverageSuccessful: runs.length,
    publicationStatus,
    comparability: comparison.comparability,
    deltaTotal: comparison.deltaTotal,
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

// Pilar 6 — Citas y autoridad externa (15%).
//
// P0.2-B — la DEFINICION no cambia: sigue siendo la proporcion de runs cuyas citas apuntan
// a directorios. Lo que cambia es la POBLACION: de "todos los runs del cliente en toda su
// historia" a "los canonicos de esta sesion". Antes su denominador era el historico
// completo mientras el pilar 8 miraba otra cosa; ahora ambos reciben el mismo array.
function scorePillar6ExternalCitations(trackingRuns: TrackingRunWithCitations[]): PillarScore {
  if (trackingRuns.length === 0) return { subscore: 0, measured: false };

  const runsWithDirectoryCitation = trackingRuns.filter((run) =>
    (run.citations ?? []).some((c) => c.is_directory === true)
  ).length;

  return { subscore: (runsWithDirectoryCitation / trackingRuns.length) * 100, measured: true };
}

// Pilar 8 — Tasa de Aparicion Organica (TAO), 13%.
//
// P0.1 — solo entran runs `clean_blind` con clasificacion no degradada. La compuerta vive
// en toTaoObservation() y es imposible de saltar por tipos. P0.2-B no la toca: solo le
// entrega una poblacion acotada a la sesion en vez del historico entero.
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
  // bien. Confundir ambas cosas es el error que P0.1 corrige.
  if (tao.rate === null) return { subscore: 0, measured: false };

  return { subscore: tao.rate, measured: true };
}

interface CompareInput {
  clientId: string;
  sessionId: string;
  methodologyVersion: string;
  promptSetHash: string;
  engineSet: string[];
  scoreTotal: number;
}

/**
 * Decide si el score nuevo puede compararse con el anterior, y solo entonces calcula el Δ.
 *
 * Un delta entre metodologias distintas seria una afirmacion falsa: tras P0.1 el pilar 8
 * cambio de significado, asi que restar un score v1 de uno v2 produciria una "caida" que el
 * cliente leeria como "empeore" cuando en realidad es "antes te mediamos mal". Cuando no es
 * comparable el delta queda en null y la UI no debe inventarlo.
 */
async function compareWithPrevious(
  admin: ReturnType<typeof createAdminClient>,
  input: CompareInput,
): Promise<{ previousSnapshotId: string | null; deltaTotal: number | null; comparability: Comparability | null }> {
  const { data: previous } = await admin
    .from("ai_visibility_scores")
    .select("id, score_total, methodology_version, session_id, measurement_sessions(prompt_set_hash, engine_set)")
    .eq("client_id", input.clientId)
    .eq("publication_status", "published")
    .not("session_id", "is", null)
    .neq("session_id", input.sessionId)
    .order("calculated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Primera medicion con esta metodologia: no hay con que comparar. null != 0 — la UI debe
  // decir "primera medicion", no "no cambio".
  if (!previous) return { previousSnapshotId: null, deltaTotal: null, comparability: null };

  const prevSession = previous.measurement_sessions as unknown as
    | { prompt_set_hash: string; engine_set: string[] }
    | null;

  const sameMethodology = previous.methodology_version === input.methodologyVersion;
  const samePromptSet = prevSession?.prompt_set_hash === input.promptSetHash;
  const sameEngines =
    prevSession != null && [...prevSession.engine_set].sort().join(",") === [...input.engineSet].sort().join(",");

  if (!sameMethodology || !samePromptSet || !sameEngines) {
    return { previousSnapshotId: previous.id, deltaTotal: null, comparability: "not_comparable" };
  }

  // Mismo panel, misma metodologia, mismos motores: queda ver si el proveedor cambio el
  // modelo bajo nuestros pies. Ocurre constantemente (los alias se mueven solos), asi que
  // tratarlo como incomparable haria que casi ninguna comparacion fuera posible — se marca
  // con salvedad en vez de suprimirse.
  const modelsChanged = await resolvedModelsDiffer(admin, previous.session_id!, input.sessionId);

  return {
    previousSnapshotId: previous.id,
    deltaTotal: round2(input.scoreTotal - Number(previous.score_total)),
    comparability: modelsChanged ? "comparable_with_caveat" : "comparable",
  };
}

async function resolvedModelsDiffer(
  admin: ReturnType<typeof createAdminClient>,
  previousSessionId: string,
  currentSessionId: string,
): Promise<boolean> {
  const [{ data: prev }, { data: curr }] = await Promise.all([
    admin.from("tracking_runs").select("model_resolved").eq("session_id", previousSessionId).eq("is_canonical", true),
    admin.from("tracking_runs").select("model_resolved").eq("session_id", currentSessionId).eq("is_canonical", true),
  ]);

  const setOf = (rows: Array<{ model_resolved: string | null }> | null) =>
    [...new Set((rows ?? []).map((r) => r.model_resolved).filter((m): m is string => Boolean(m)))].sort().join(",");

  const a = setOf(prev);
  const b = setOf(curr);
  // Si alguno no registro modelo (runs anteriores a P0.2-B) no se puede afirmar que cambio.
  if (!a || !b) return false;
  return a !== b;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
