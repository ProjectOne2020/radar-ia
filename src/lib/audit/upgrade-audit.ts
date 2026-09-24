import type { createAdminClient } from "@/lib/supabase/admin";
import { runMeasurementForPromptSet } from "@/lib/ai-engines/run-measurement";
import { runAuditForClient } from "./run-audit";
import { calculateScoreForSession } from "@/lib/scoring/calculate-score";
import { consumeTrialAuditForMeasurement } from "@/lib/admin/trial-policy";
import { closeSession, openSession } from "@/lib/measurement/session";
import { ensurePromptDepth } from "./ensure-prompt-depth";

// 01-CONTEXTO-NEGOCIO.md seccion 4 da el numero de preguntas por plan como un RANGO
// (Lite "5-10", Plus "15-30") -- se usa el extremo superior de cada rango como el numero
// final una vez pagado (el extremo inferior es solo el arranque de la auditoria gratis).
// Pro no tiene un numero literal en el documento (solo "semanal" de cadencia) -- 40 es una
// extrapolacion, NO un numero confirmado por el fundador; ver nota en
// 04-MODULOS-CONSTRUCCION.md, ajustar si lo corrige.
export const TARGET_PROMPT_COUNT: Record<string, number> = {
  lite: 10,
  plus: 30,
  pro: 40,
};

// Hueco encontrado por el fundador probando su propia cuenta real: pagar nunca ampliaba
// las preguntas de medicion mas alla de las 5 de la auditoria gratis original (el cron de
// M11 solo re-corre lo que ya existe, nunca lo aumenta). Se dispara desde el webhook de
// Stripe justo al confirmarse la suscripcion (type=subscription), una sola vez por cliente
// -- idempotente ante reintentos del webhook: si ya alcanzo el target, no hace nada.
export async function upgradeAuditForClient(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
  plan: string,
): Promise<void> {
  const target = TARGET_PROMPT_COUNT[plan];
  if (!target) return;

  await ensurePromptDepth(admin, clientId, target);

  const { data: allActivePrompts } = await admin
    .from("prompt_sets")
    .select("id, prompt_text")
    .eq("client_id", clientId)
    .eq("active", true);
  const prompts = allActivePrompts ?? [];

  // null = ya hay una sesion abierta viva (reentrega del webhook de Stripe, por ejemplo).
  // No se mide dos veces.
  const session = await openSession(admin, {
    clientId,
    trigger: "upgrade_after_payment",
    promptTexts: prompts.map((p) => p.prompt_text),
  });
  if (!session) return;

  await Promise.allSettled(prompts.map((p) => runMeasurementForPromptSet(p.id, session.sessionId)));
  await runAuditForClient(clientId, session.sessionId);
  await closeSession(admin, session.sessionId);
  await calculateScoreForSession(session.sessionId);

  // P0.2-A — este trigger NO consume (decision del fundador al cerrar P0.2-A): esta
  // medicion es parte de la ACTIVACION de lo que el cliente acaba de pagar, no una de sus
  // auditorias del trial. La llamada se conserva para que el "por que" quede declarado
  // aqui y la politica siga viviendo en un solo lugar — ver trial-policy.ts.
  await consumeTrialAuditForMeasurement(admin, clientId, "upgrade_after_payment", session.sessionId);
}
