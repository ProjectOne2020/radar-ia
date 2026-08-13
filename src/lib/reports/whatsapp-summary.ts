import { sendWhatsAppText } from "@/lib/whatsapp/send-message";

// M10 — resumen corto por WhatsApp con link al dashboard (el reporte completo vive en
// dashboard/email, WhatsApp es el gancho de atencion — 03-ARQUITECTURA-TECNICA.md).
export async function sendReportWhatsAppSummary(
  phone: string,
  businessName: string,
  scoreTotal: number,
  dashboardUrl: string
) {
  const message = `Radar IA: tu score de visibilidad en IA para ${businessName} es ${Math.round(scoreTotal)}/100. Ve el reporte completo: ${dashboardUrl}`;
  return sendWhatsAppText(phone, message);
}

export async function sendScoreDropAlert(
  phone: string,
  businessName: string,
  previousScore: number,
  currentScore: number,
  dashboardUrl: string
) {
  const message = `⚠️ Radar IA: el score de visibilidad en IA de ${businessName} bajó de ${Math.round(previousScore)} a ${Math.round(currentScore)}. Revisa qué cambió: ${dashboardUrl}`;
  return sendWhatsAppText(phone, message);
}

export async function sendNapDiscrepancyAlert(phone: string, businessName: string, dashboardUrl: string) {
  const message = `⚠️ Radar IA: detectamos una discrepancia de datos (NAP) en ${businessName} — el teléfono/dirección declarado no coincide con lo que la IA está leyendo. Revisa: ${dashboardUrl}`;
  return sendWhatsAppText(phone, message);
}
