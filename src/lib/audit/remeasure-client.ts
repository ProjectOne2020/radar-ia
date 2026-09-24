import type { createAdminClient } from "@/lib/supabase/admin";
import { runMeasurementForPromptSet } from "@/lib/ai-engines/run-measurement";
import { runAuditForClient } from "./run-audit";
import { calculateScoreForSession } from "@/lib/scoring/calculate-score";
import { consumeTrialAuditForMeasurement } from "@/lib/admin/trial-policy";
import { closeSession, openSession } from "@/lib/measurement/session";
import { ensurePromptDepth } from "./ensure-prompt-depth";
import { TARGET_PROMPT_COUNT } from "./upgrade-audit";

// M42 — boton "Correr auditoria completa ahora" en /admin/clientes/[id], a pedido del
// fundador. Distinto de dos cosas que ya existen: el cron de M11 (remeasure-due-clients.ts)
// solo corre por cliente cuando le toca segun la cadencia de su plan, nunca a demanda; y
// upgradeAuditForClient (upgrade-audit.ts) amplia el set de preguntas solo hasta lo que el
// plan pagado justifica. Este boton es 100% interno para el admin — sin pago de por medio
// amplia siempre al tope maximo (Pro, mismo TARGET_PROMPT_COUNT.pro) antes de medir, para
// que "completa" sea real y no solo re-corra las 5 preguntas originales de una auditoria
// creada desde /admin/auditar (el bug que reporto el fundador: el boton casi no cambiaba
// nada porque nunca ampliaba el set, solo lo repetia). No envia el reporte ni corre
// check-alerts — eso es una accion aparte (M10).
export async function remeasureClientNow(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
): Promise<void> {
  await ensurePromptDepth(admin, clientId, TARGET_PROMPT_COUNT.pro);

  const { data: activePrompts, error: promptsError } = await admin
    .from("prompt_sets")
    .select("id, prompt_text")
    .eq("client_id", clientId)
    .eq("active", true);

  if (promptsError) throw new Error(promptsError.message);
  const prompts = activePrompts ?? [];

  // P0.2-B — toda medicion vive dentro de una sesion. null = ya hay una sesion abierta viva
  // para este cliente (doble click en el boton, o el cron corriendo ahora mismo): no se
  // crea una segunda medicion ni se gasta credito de API dos veces.
  const session = await openSession(admin, {
    clientId,
    trigger: "admin_manual_remeasure",
    promptTexts: prompts.map((p) => p.prompt_text),
  });
  if (!session) return;

  await Promise.allSettled(prompts.map((p) => runMeasurementForPromptSet(p.id, session.sessionId)));
  await runAuditForClient(clientId, session.sessionId);
  await closeSession(admin, session.sessionId);
  await calculateScoreForSession(session.sessionId);

  // P0.2-A — el consumo se decide aqui, no dentro del calculo del score.
  //
  // Este trigger NO consume (decision del fundador al cerrar P0.2-A): correr la auditoria
  // a mano desde /admin es trabajo interno y gratuito para el cliente. La llamada se
  // conserva igual para que el "por que" quede declarado en el sitio donde se mide y la
  // politica siga viviendo en un solo lugar — ver trial-policy.ts.
  await consumeTrialAuditForMeasurement(admin, clientId, "admin_manual_remeasure", session.sessionId);
}
