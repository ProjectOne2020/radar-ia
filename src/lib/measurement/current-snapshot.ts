import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { METHODOLOGY_VERSION } from "./versions";

type Db = SupabaseClient<Database>;

// P0.2-B — "cual es el score ACTUAL de este cliente" en un solo lugar.
//
// ===========================================================================
// POR QUE ESTE MODULO TIENE QUE EXISTIR
// ===========================================================================
// Al quitar el DELETE de audit_findings (run-audit.ts), la pregunta "¿que hallazgos tiene
// este cliente?" dejo de tener una respuesta unica: ahora hay uno por cada auditoria que se
// le haya corrido. Preguntar `where client_id = X` devolveria el acumulado de todas las
// sesiones — el mismo defecto que el DELETE existia para evitar, reaparecido por otra via.
//
// La pregunta correcta pasa a ser: "¿que hallazgos tiene LA SESION del score publicado?".
// Este modulo la responde una vez y todos los lectores la reusan, para que la version
// ambigua no vuelva a aparecer copiada en seis archivos.
// ===========================================================================

export interface CurrentSnapshot {
  id: string;
  /** null solo en los snapshots legacy anteriores a P0.2-B. */
  sessionId: string | null;
  scoreTotal: number;
  scoreByPillar: Record<string, { subscore: number; measured: boolean; weight_pct?: number }>;
  calculatedAt: string | null;
  methodologyVersion: string;
  coverageExpected: number | null;
  coverageSuccessful: number | null;
  deltaTotal: number | null;
  comparability: string | null;
  /**
   * true = medido con una metodologia anterior a P0.2-B. La UI DEBE mostrarlo con
   * disclaimer y no compararlo con nada: tras P0.1 el pilar 8 cambio de significado, asi
   * que restarlo de un score v2 produciria una "caida" que el cliente leeria como
   * "empeore" cuando en realidad es "antes te mediamos mal".
   */
  isLegacy: boolean;
}

const SELECT =
  "id, session_id, score_total, score_by_pillar, calculated_at, methodology_version, coverage_expected, coverage_successful, delta_total, comparability";

interface SnapshotRow {
  id: string;
  session_id: string | null;
  score_total: number;
  score_by_pillar: Json;
  calculated_at: string | null;
  methodology_version: string;
  coverage_expected: number | null;
  coverage_successful: number | null;
  delta_total: number | null;
  comparability: string | null;
}

function toSnapshot(row: SnapshotRow): CurrentSnapshot {
  return {
    id: row.id,
    sessionId: row.session_id,
    scoreTotal: Number(row.score_total),
    scoreByPillar:
      (row.score_by_pillar as unknown as Record<string, { subscore: number; measured: boolean; weight_pct?: number }>) ??
      {},
    calculatedAt: row.calculated_at,
    methodologyVersion: row.methodology_version,
    coverageExpected: row.coverage_expected,
    coverageSuccessful: row.coverage_successful,
    deltaTotal: row.delta_total,
    comparability: row.comparability,
    isLegacy: row.methodology_version !== METHODOLOGY_VERSION,
  };
}

/**
 * El score que se le enseña al cliente hoy.
 *
 * Prioridad:
 *   1. Ultimo snapshot PUBLICADO de la metodologia vigente. Es UNA sesion concreta, no un
 *      agregado de la historia.
 *   2. Si no hay ninguno —que sera el caso de todos los clientes hasta su proxima
 *      medicion— el ultimo score legacy, marcado `isLegacy` para que la UI lo muestre con
 *      disclaimer (decision del fundador). No se oculta informacion que el cliente ya vio;
 *      se etiqueta para que no se lea como actual.
 *
 * `clientId` es opcional: con el cliente RLS la fila ya viene filtrada por la sesion del
 * usuario; con el cliente admin hay que pasarlo.
 */
export async function loadCurrentSnapshot(db: Db, clientId?: string): Promise<CurrentSnapshot | null> {
  let published = db
    .from("ai_visibility_scores")
    .select(SELECT)
    .eq("publication_status", "published")
    .eq("methodology_version", METHODOLOGY_VERSION)
    .order("calculated_at", { ascending: false })
    .limit(1);
  if (clientId) published = published.eq("client_id", clientId);

  const { data: current } = await published.maybeSingle();
  if (current) return toSnapshot(current as SnapshotRow);

  // Fallback SOLO a legacy. Un snapshot v2 `withheld` (sesion partial o failed) NO puede
  // caer aqui: se mostraria como "tu score actual" sin ninguna marca, cuando precisamente
  // no se publico porque la medicion quedo incompleta. Presentarlo seria dar por verificado
  // algo que el sistema decidio no verificar.
  let legacy = db
    .from("ai_visibility_scores")
    .select(SELECT)
    .neq("methodology_version", METHODOLOGY_VERSION)
    .order("calculated_at", { ascending: false })
    .limit(1);
  if (clientId) legacy = legacy.eq("client_id", clientId);

  const { data: previous } = await legacy.maybeSingle();
  return previous ? toSnapshot(previous as SnapshotRow) : null;
}

/**
 * Hallazgos que EXPLICAN el snapshot dado — no "los del cliente".
 *
 * Para un snapshot legacy se devuelven los findings sin sesion, que son los unicos que
 * existian entonces. Para uno v2, los de su sesion. En ninguno de los dos casos se mezclan.
 */
export function findingsQueryForSnapshot(db: Db, snapshot: CurrentSnapshot, clientId?: string) {
  let query = db.from("audit_findings").select("*");
  if (clientId) query = query.eq("client_id", clientId);

  return snapshot.sessionId ? query.eq("session_id", snapshot.sessionId) : query.is("session_id", null);
}
