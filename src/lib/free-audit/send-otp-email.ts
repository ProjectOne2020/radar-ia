// Canal de verificación de la auditoría gratis: WhatsApp Cloud API está bloqueado en
// producción (app en modo de desarrollo de Meta, error 131030 "recipient not in allowed
// list" — requiere verificación de negocio + revisión de plantilla "Authentication" que
// el fundador decidió posponer). Mientras tanto, el código OTP se manda por correo
// (Resend, mismo patrón REST que webapp/src/lib/reports/email-report.ts) — el teléfono
// se sigue pidiendo y guardando en el formulario para anti-abuso y para cuando WhatsApp
// vuelva a estar disponible, solo deja de ser el canal de entrega del código.
export async function sendOtpEmail(
  toEmail: string,
  code: string
): Promise<{ sent: boolean; reason?: string; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    console.log(`[Resend NO CONFIGURADO] Código OTP para ${toEmail}: ${code}`);
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
      subject: "Tu código para ver tu auditoría gratis",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h1 style="color:#1a1a1a;font-size:20px;">Radar IA</h1>
          <p style="font-size:15px;color:#333;">Tu código para ver tu auditoría gratis es:</p>
          <p style="font-size:32px;font-weight:bold;letter-spacing:0.2em;color:#3c78d8;margin:16px 0;">${code}</p>
          <p style="font-size:13px;color:#777;">Vence en 10 minutos. Si no pediste esta auditoría, ignora este correo.</p>
        </div>
      `,
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
