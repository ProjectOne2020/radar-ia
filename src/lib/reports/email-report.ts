const PILLAR_NAMES: Record<string, string> = {
  "1": "Identidad/consistencia (NAP)",
  "2": "Google Business Profile",
  "3": "Crawlability + schema técnico",
  "4": "Estructura semántica",
  "5": "Cobertura de preguntas",
  "6": "Citas y autoridad externa",
  "7": "Reputación (reseñas)",
  "8": "Medición directa en motores de IA",
};

export interface PillarEntry {
  subscore: number;
  measured: boolean;
  weight_pct: number;
}

export interface ReportData {
  businessName: string;
  scoreTotal: number;
  scoreByPillar: Record<string, PillarEntry>;
  findingsCount: { critical: number; warning: number; info: number };
  dashboardUrl: string;
  // true solo para el correo de la auditoria gratis (M34) -- un cliente de pago ya tiene
  // la auditoria completa, decirle "suscribete para desbloquearla" no aplica y confunde.
  isFreeTier?: boolean;
}

// M10 — reporte periodico por email (Resend). No usa el SDK de Resend, fetch directo a su
// REST API — mismo patron que el resto de integraciones del proyecto.
export function buildReportHtml(data: ReportData): string {
  const pillarRows = Object.entries(data.scoreByPillar)
    .map(([pillar, info]) => {
      const label = PILLAR_NAMES[pillar] ?? `Pilar ${pillar}`;
      const value = info.measured ? `${Math.round(info.subscore)}/100` : "sin datos suficientes";
      return `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;">${label}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;">${value}</td></tr>`;
    })
    .join("");

  const partialBanner = data.isFreeTier
    ? `
      <div style="margin:16px 0;padding:14px 16px;background:#fff4e5;border:1px solid #f0b429;border-radius:6px;">
        <p style="margin:0;font-size:14px;font-weight:bold;color:#92400e;">⚠️ Esto NO es la auditoría completa</p>
        <p style="margin:6px 0 0;font-size:13px;color:#92400e;">Este correo muestra un adelanto gratuito y parcial. Para la auditoría completa de tu negocio — y que nuestro equipo implemente la solución por ti — necesitas suscribirte a un plan.</p>
      </div>
    `
    : "";

  const ctaLabel = data.isFreeTier ? "Ver planes y desbloquear la auditoría completa" : "Ver reporte completo";
  const ctaHref = data.isFreeTier ? "https://radar.omniflowcreator.com/precios" : data.dashboardUrl;

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h1 style="color:#1a1a1a;">Radar IA — Reporte de ${data.businessName}</h1>
      ${partialBanner}
      <p style="font-size:32px;font-weight:bold;color:#3c78d8;margin:16px 0;">${Math.round(data.scoreTotal)}/100</p>

      <h2 style="font-size:16px;color:#333;">Desglose por pilar</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">${pillarRows}</table>

      <h2 style="font-size:16px;color:#333;margin-top:24px;">Hallazgos</h2>
      <p style="font-size:14px;color:#555;">
        ${data.findingsCount.critical} crítico(s), ${data.findingsCount.warning} advertencia(s), ${data.findingsCount.info} informativo(s).
      </p>

      <a href="${ctaHref}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#3c78d8;color:#fff;text-decoration:none;border-radius:6px;">
        ${ctaLabel}
      </a>
      ${data.isFreeTier ? `<p style="margin-top:8px;"><a href="${data.dashboardUrl}" style="font-size:12px;color:#777;">o ver este adelanto de nuevo</a></p>` : ""}

      <p style="font-size:12px;color:#999;margin-top:32px;">
        Radar IA — no podemos controlar qué negocio recomienda una IA, pero medimos mes a mes qué tan completa y verificable es la información que esa IA encuentra sobre tu negocio.
      </p>
    </div>
  `;
}

export async function sendReportEmail(
  toEmail: string,
  data: ReportData
): Promise<{ sent: boolean; reason?: string; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    console.log(`[Resend NO CONFIGURADO] Reporte para ${toEmail}: score ${data.scoreTotal}`);
    return { sent: false, reason: "RESEND_API_KEY/RESEND_FROM_EMAIL no configurados" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: `Radar IA <${fromEmail}>`,
      to: [toEmail],
      subject: `Tu reporte de visibilidad en IA — ${data.businessName}`,
      html: buildReportHtml(data),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[Resend ERROR] ${res.status}: ${body}`);
    return { sent: false, reason: `Resend API error ${res.status}: ${body}` };
  }

  const json = await res.json();
  return { sent: true, id: json.id };
}
