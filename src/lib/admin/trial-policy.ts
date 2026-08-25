import type { createAdminClient } from "@/lib/supabase/admin";

// P0.2-A — QUIEN decide si una medicion consume una auditoria del trial.
//
// ===========================================================================
// EL DEFECTO QUE ESTO CORRIGE
// ===========================================================================
// Hasta P0.2-A, `consumeTrialAuditIfActive()` vivia DENTRO de
// `calculateScoreForClient()`. Consecuencia: calcular un score —por cualquier
// motivo— descontaba una auditoria del trial. Recalcular para depurar, recalcular
// tras cambiar la metodologia, o pegarle a /api/score en una prueba, cobraban.
//
// Una funcion de calculo no puede tener un efecto secundario comercial. El calculo
// es puro; la decision de cobrar es del orquestador, que es el unico que sabe POR QUE
// se esta midiendo.
//
// Este modulo existe para que ese "por que" sea un dato explicito y testeable en vez
// de una consecuencia accidental del grafo de llamadas.
// ===========================================================================

/**
 * Por que se disparo una medicion. Cada punto de entrada real del producto tiene su
 * propio valor: si aparece un flujo nuevo, el compilador obliga a declarar su politica
 * aqui en vez de heredarla por accidente.
 */
export type MeasurementTrigger =
  /** Cron M11: le toca al cliente segun la cadencia de su plan. */
  | "cron_scheduled"
  /** Boton "Correr auditoria completa ahora" en /admin/clientes/[id] (M42). */
  | "admin_manual_remeasure"
  /** Webhook de Stripe tras un pago confirmado: amplia preguntas y remide (upgrade-audit). */
  | "upgrade_after_payment"
  /** Primera medicion de un cliente self-serve que acaba de completar su eje (M28). */
  | "dashboard_setup"
  /** Auditoria gratis publica y sus variantes (partners, /admin/auditar). */
  | "free_audit"
  /** Medicion de un competidor dado de alta por el dueño (M7). */
  | "competitor_snapshot"
  /** Recalculo de score sobre runs YA existentes. No hay medicion nueva. */
  | "score_recalculation";

/**
 * Politica de consumo.
 *
 * El criterio, decidido por el fundador al cerrar P0.2-A: una auditoria del trial se gasta
 * cuando el PRODUCTO entrega al cliente una medicion nueva por su propia cadencia. No se
 * gasta por trabajo interno, ni por activar algo que el cliente ya pago, ni por recalcular.
 *
 * CONSUMEN:
 * - `cron_scheduled`   — el caso canonico. grantTemporaryPlan deja subscriptions.status
 *                        ='active', asi que un cliente con trial entra por el mismo cron
 *                        que uno que paga. "N auditorias completas" son exactamente estas.
 * - `dashboard_setup`  — primera medicion completa del cliente.
 *
 * NO CONSUMEN:
 * - `admin_manual_remeasure` — herramienta interna y gratuita para el cliente. Si depurar
 *                        un cliente le agotara el trial, la herramienta seria inusable.
 * - `upgrade_after_payment` — la medicion posterior a un pago es parte de la ACTIVACION de
 *                        lo que el cliente acaba de comprar. Cobrarle ademas una auditoria
 *                        del trial seria cobrar dos veces por lo mismo.
 * - `free_audit`       — el flujo crea una fila `clients` NUEVA y puntua ESA fila, que por
 *                        construccion nunca tiene `trial_grants`. Nunca consumio nada;
 *                        declararlo solo impide que un cambio futuro lo rompa en silencio.
 * - `competitor_snapshot` — idem: puntua la fila del competidor, no la del dueño.
 * - `score_recalculation` — no hay medicion nueva. Sin medicion no puede haber cobro.
 */
export function consumesTrialAudit(trigger: MeasurementTrigger): boolean {
  switch (trigger) {
    case "cron_scheduled":
    case "dashboard_setup":
      return true;

    case "admin_manual_remeasure":
    case "upgrade_after_payment":
    case "free_audit":
    case "competitor_snapshot":
    case "score_recalculation":
      return false;
  }
}

/**
 * Unico punto por el que una medicion puede descontar del trial. Los orquestadores llaman
 * aqui DESPUES de que la medicion termino de verdad; nunca lo hace el calculo del score.
 *
 * P0.2-B — AHORA SI ES IDEMPOTENTE Y ATOMICO. El descuento se delega a la RPC
 * `consume_trial_audit_for_session`, que en UNA transaccion:
 *
 *   1. bloquea la fila del grant (`for update`) — serializa a los concurrentes;
 *   2. inserta en `trial_consumptions` con PK = session_id — si ya se consumio, no hay
 *      segunda vez, nunca;
 *   3. descuenta con `audits_remaining = audits_remaining - 1` en SQL, no con un `n - 1`
 *      calculado en JS (que era un lost update clasico);
 *   4. si llega a 0, revierte la suscripcion dentro de la misma transaccion.
 *
 * Por eso `sessionId` es obligatorio: es la identidad durable que hace posible la
 * idempotencia. Sin sesion no hay forma de distinguir un reintento de una auditoria nueva.
 */
export async function consumeTrialAuditForMeasurement(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
  trigger: MeasurementTrigger,
  sessionId: string,
): Promise<void> {
  if (!consumesTrialAudit(trigger)) return;

  const { error } = await admin.rpc("consume_trial_audit_for_session", {
    p_session_id: sessionId,
    p_client_id: clientId,
  });

  if (error) {
    throw new Error(`No se pudo consumir la auditoria del trial (sesion ${sessionId}): ${error.message}`);
  }
}
