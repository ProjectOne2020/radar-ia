import { createAdminClient } from "@/lib/supabase/admin";
import { sendReportEmail } from "./email-report";
import { sendReportWhatsAppSummary } from "./whatsapp-summary";

interface PillarEntry {
  subscore: number;
  measured: boolean;
  weight_pct: number;
}

export interface SendReportResult {
  email: { sent: boolean; reason?: string };
  whatsapp: { sent: boolean; reason?: string };
}

// M10 — genera y envia el reporte periodico (email real + resumen WhatsApp real) para un
// cliente, usando su score y hallazgos mas recientes.
export async function sendReportForClient(clientId: string): Promise<SendReportResult> {
  const admin = createAdminClient();

  const [{ data: client, error: clientError }, { data: score, error: scoreError }, { data: findings }] =
    await Promise.all([
      admin.from("clients").select("business_name, email, phone_whatsapp").eq("id", clientId).single(),
      admin
        .from("ai_visibility_scores")
        .select("score_total, score_by_pillar")
        .eq("client_id", clientId)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .single(),
      admin.from("audit_findings").select("severity").eq("client_id", clientId),
    ]);

  if (clientError || !client) throw new Error(`No se encontró el cliente ${clientId}: ${clientError?.message}`);
  if (scoreError || !score) throw new Error(`El cliente ${clientId} todavía no tiene un score calculado.`);

  const findingsCount = { critical: 0, warning: 0, info: 0 };
  for (const f of findings ?? []) {
    if (f.severity === "critical") findingsCount.critical += 1;
    else if (f.severity === "warning") findingsCount.warning += 1;
    else findingsCount.info += 1;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const dashboardUrl = `${appUrl}/dashboard`;

  const emailResult = client.email
    ? await sendReportEmail(client.email, {
        businessName: client.business_name,
        scoreTotal: score.score_total,
        scoreByPillar: score.score_by_pillar as unknown as Record<string, PillarEntry>,
        findingsCount,
        dashboardUrl,
      })
    : { sent: false, reason: "El cliente no tiene email registrado." };

  const whatsappResult = await sendReportWhatsAppSummary(
    client.phone_whatsapp,
    client.business_name,
    score.score_total,
    dashboardUrl
  );

  return { email: emailResult, whatsapp: whatsappResult };
}
