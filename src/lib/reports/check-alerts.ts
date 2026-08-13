import { createAdminClient } from "@/lib/supabase/admin";
import { sendScoreDropAlert, sendNapDiscrepancyAlert } from "./whatsapp-summary";

// Umbral de "caida significativa" — NO esta definido en ningun documento del proyecto.
// Default razonable elegido durante la construccion de M10: 10 puntos o mas respecto al
// calculo anterior. Ajustable — no es un peso de scoring ni un precio, es un parametro
// operativo de cuando alertar.
const SIGNIFICANT_DROP_THRESHOLD = 10;

export interface AlertCheckResult {
  scoreDropDetected: boolean;
  napDiscrepancyDetected: boolean;
  alertsSent: string[];
}

// M10 — alerta inmediata por WhatsApp si el score cae significativamente o se detecta una
// discrepancia de NAP nueva (03-ARQUITECTURA-TECNICA.md).
export async function checkAndSendAlerts(clientId: string): Promise<AlertCheckResult> {
  const admin = createAdminClient();

  const [{ data: client, error: clientError }, { data: scores }, { data: napFindings }] = await Promise.all([
    admin.from("clients").select("business_name, phone_whatsapp").eq("id", clientId).single(),
    admin
      .from("ai_visibility_scores")
      .select("score_total, calculated_at")
      .eq("client_id", clientId)
      .order("calculated_at", { ascending: false })
      .limit(2),
    admin
      .from("audit_findings")
      .select("finding, severity, audited_at")
      .eq("client_id", clientId)
      .eq("pillar", 1)
      .eq("severity", "critical")
      .order("audited_at", { ascending: false })
      .limit(1),
  ]);

  if (clientError || !client) throw new Error(`No se encontró el cliente ${clientId}: ${clientError?.message}`);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const dashboardUrl = `${appUrl}/dashboard`;
  const result: AlertCheckResult = { scoreDropDetected: false, napDiscrepancyDetected: false, alertsSent: [] };

  if (scores && scores.length === 2) {
    const [current, previous] = scores;
    const drop = previous.score_total - current.score_total;
    if (drop >= SIGNIFICANT_DROP_THRESHOLD) {
      result.scoreDropDetected = true;
      const sent = await sendScoreDropAlert(
        client.phone_whatsapp,
        client.business_name,
        previous.score_total,
        current.score_total,
        dashboardUrl
      );
      if (sent.sent) result.alertsSent.push("score_drop");
    }
  }

  // Discrepancia de NAP mas reciente: si es del calculo mas reciente (audited_at posterior
  // al score anterior a este), se considera "nueva" — comparacion simple por fecha, no
  // requiere una tabla de estado adicional.
  if (napFindings && napFindings.length > 0) {
    const mostRecentScore = scores?.[0];
    const findingIsRecent =
      !mostRecentScore?.calculated_at ||
      new Date(napFindings[0].audited_at ?? 0) >= new Date(mostRecentScore.calculated_at);

    if (findingIsRecent) {
      result.napDiscrepancyDetected = true;
      const sent = await sendNapDiscrepancyAlert(client.phone_whatsapp, client.business_name, dashboardUrl);
      if (sent.sent) result.alertsSent.push("nap_discrepancy");
    }
  }

  return result;
}

export { SIGNIFICANT_DROP_THRESHOLD };
