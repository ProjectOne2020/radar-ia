import { createAdminClient } from "@/lib/supabase/admin";
import { runMeasurementForPromptSet } from "@/lib/ai-engines/run-measurement";
// P0.2-B — el cron ahora TAMBIEN corre la auditoria tecnica. Antes no lo hacia y se
// apoyaba en los findings que hubiera dejado una auditoria anterior. Con los findings
// acotados a la sesion eso ya no funciona: una sesion sin auditoria propia tendria los
// pilares 1-5 y 7 sin medir, es decir el 72% del score. La auditoria pasa a formar parte
// de la sesion, que es lo que el diseño aprobado establece.
import { runAuditForClient } from "@/lib/audit/run-audit";
import { calculateScoreForSession } from "@/lib/scoring/calculate-score";
import { consumeTrialAuditForMeasurement } from "@/lib/admin/trial-policy";
import { closeSession, openSession, sweepZombieSessions } from "@/lib/measurement/session";
import { sendReportForClient } from "@/lib/reports/send-report";
import { checkAndSendAlerts } from "@/lib/reports/check-alerts";
import { isDueForRemeasurement } from "./plan-frequency";

export interface RemeasureSummary {
  checked: number;
  due: number;
  processed: Array<{ clientId: string; businessName: string; ok: boolean; error?: string }>;
}

// M11 — recorre clientes con suscripcion activa, dispara M2 (todos sus prompt_sets
// activos) + M4 (recalculo de score) para los que les toca segun la frecuencia de su
// plan, y despues M10 (reporte + chequeo de alertas) — la funcion "que enviar" ya estaba
// en M10, este cron es el "cuando" (documentado asi desde que se construyo M10).
//
// Solo procesa clientes con subscriptions.status = 'active': los clientes internos de
// auditoria gratis (M6) y de competidores (M7) no tienen suscripcion real y no deben
// consumir credito de las APIs de IA en cada corrida del cron.
export async function remeasureDueClients(): Promise<RemeasureSummary> {
  const admin = createAdminClient();

  const { data: activeSubs, error: subsError } = await admin
    .from("subscriptions")
    .select("client_id, plan, clients(business_name)")
    .eq("status", "active");

  if (subsError) throw new Error(`No se pudieron leer suscripciones activas: ${subsError.message}`);

  // P0.2-B — barrido periodico de sesiones zombi. Sin esto, una sesion que quedo abierta
  // por un timeout de serverless bloquearia para siempre a ese cliente: el indice unico
  // parcial impide abrir una segunda. El barrido convierte el candado en algo temporal.
  await sweepZombieSessions(admin);

  const summary: RemeasureSummary = { checked: activeSubs?.length ?? 0, due: 0, processed: [] };

  for (const sub of activeSubs ?? []) {
    if (!sub.client_id) continue;

    const { data: latestScore } = await admin
      .from("ai_visibility_scores")
      .select("calculated_at")
      .eq("client_id", sub.client_id)
      .order("calculated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!isDueForRemeasurement(sub.plan, latestScore?.calculated_at ?? null)) continue;

    summary.due += 1;
    const businessName = (sub.clients as { business_name?: string } | null)?.business_name ?? "(desconocido)";

    try {
      const { data: activePrompts, error: promptsError } = await admin
        .from("prompt_sets")
        .select("id, prompt_text")
        .eq("client_id", sub.client_id)
        .eq("active", true);

      if (promptsError) throw new Error(promptsError.message);
      const prompts = activePrompts ?? [];

      // null = ya hay una sesion abierta viva para este cliente (una corrida anterior del
      // cron sigue en curso). No se crea una segunda medicion ni se gasta credito de API.
      const session = await openSession(admin, {
        clientId: sub.client_id,
        trigger: "cron_scheduled",
        promptTexts: prompts.map((p) => p.prompt_text),
      });
      if (!session) {
        summary.processed.push({ clientId: sub.client_id, businessName, ok: true });
        continue;
      }

      await Promise.allSettled(prompts.map((p) => runMeasurementForPromptSet(p.id, session.sessionId)));
      await runAuditForClient(sub.client_id, session.sessionId);
      await closeSession(admin, session.sessionId);
      const score = await calculateScoreForSession(session.sessionId);

      // P0.2-A/B — el caso canonico del trial: "N auditorias completas" son exactamente
      // estas. grantTemporaryPlan deja subscriptions.status='active', asi que un cliente
      // con trial entra por este mismo cron que un cliente que paga.
      //
      // Ligado a la SESION: la RPC atomica descuenta a lo sumo una vez por session_id, asi
      // que un reintento del cron sobre la misma sesion no puede cobrar dos veces.
      await consumeTrialAuditForMeasurement(admin, sub.client_id, "cron_scheduled", session.sessionId);

      // P0.2-B — el reporte y las alertas solo salen si ESTA medicion se publico. Si la
      // sesion quedo `partial` o `failed`, el snapshot no se publica y sendReportForClient
      // describiria el score PUBLICADO ANTERIOR — es decir, le mandariamos al cliente un
      // informe con un numero viejo presentandolo como el resultado de la medicion de hoy.
      if (score.publicationStatus === "published") {
        await sendReportForClient(sub.client_id);
        await checkAndSendAlerts(sub.client_id);
      }

      summary.processed.push({ clientId: sub.client_id, businessName, ok: true });
    } catch (err) {
      summary.processed.push({
        clientId: sub.client_id,
        businessName,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return summary;
}
