import { createAdminClient } from "@/lib/supabase/admin";
import { runMeasurementForPromptSet } from "@/lib/ai-engines/run-measurement";
import { calculateScoreForClient } from "@/lib/scoring/calculate-score";
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
        .select("id")
        .eq("client_id", sub.client_id)
        .eq("active", true);

      if (promptsError) throw new Error(promptsError.message);

      await Promise.allSettled((activePrompts ?? []).map((p) => runMeasurementForPromptSet(p.id)));
      await calculateScoreForClient(sub.client_id);
      await sendReportForClient(sub.client_id);
      await checkAndSendAlerts(sub.client_id);

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
