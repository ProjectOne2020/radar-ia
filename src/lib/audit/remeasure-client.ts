import type { createAdminClient } from "@/lib/supabase/admin";
import { runMeasurementForPromptSet } from "@/lib/ai-engines/run-measurement";
import { runAuditForClient } from "./run-audit";
import { calculateScoreForClient } from "@/lib/scoring/calculate-score";
import { consumeTrialAuditForMeasurement } from "@/lib/admin/trial-policy";

// M42 — boton "Correr auditoria completa ahora" en /admin/clientes/[id], a pedido del
// fundador. Distinto de dos cosas que ya existen: el cron de M11 (remeasure-due-clients.ts)
// solo corre por cliente cuando le toca segun la cadencia de su plan, nunca a demanda; y
// upgradeAuditForClient (upgrade-audit.ts) ademas amplia el set de preguntas al primer
// pago, logica que no aplica aqui. Esto simplemente vuelve a correr el pipeline completo
// (M2 medicion de menciones en los 4 motores de IA + M3 auditoria tecnica pilares 1-7 +
// M4 recalculo de score) sobre las preguntas activas que el cliente ya tiene, para un
// cliente especifico, en cualquier momento. No envia el reporte ni corre check-alerts —
// eso es una accion aparte (M10), no implicita en "vuelve a correr la auditoria".
export async function remeasureClientNow(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
): Promise<void> {
  const { data: activePrompts, error: promptsError } = await admin
    .from("prompt_sets")
    .select("id")
    .eq("client_id", clientId)
    .eq("active", true);

  if (promptsError) throw new Error(promptsError.message);

  await Promise.allSettled((activePrompts ?? []).map((p) => runMeasurementForPromptSet(p.id)));
  await runAuditForClient(clientId);
  await calculateScoreForClient(clientId);

  // P0.2-A — el consumo se decide aqui, no dentro del calculo del score. Va DESPUES de
  // calculateScoreForClient a proposito: si el calculo lanza, no se descuenta nada.
  //
  // Este trigger NO consume (decision del fundador al cerrar P0.2-A): correr la auditoria
  // a mano desde /admin es trabajo interno y gratuito para el cliente. La llamada se
  // conserva igual para que el "por que" quede declarado en el sitio donde se mide y la
  // politica siga viviendo en un solo lugar — ver trial-policy.ts.
  await consumeTrialAuditForMeasurement(admin, clientId, "admin_manual_remeasure");
}
