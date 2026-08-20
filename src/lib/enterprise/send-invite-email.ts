// M31 — cierra el hueco encontrado al revisar el flujo Enterprise: /api/admin/enterprise-leads
// cobra al cliente por Stripe pero nunca le daba forma de iniciar sesion despues. A diferencia
// de la auditoria gratis (donde la misma persona elige su contraseña en el navegador, M30),
// aqui el fundador aprueba en SU sesion — el cliente real esta en otro dispositivo por
// completo, asi que no sirve un flujo basado en cookie. Se usa el link de invitacion nativo
// de Supabase Auth (generateLink type "invite"): crea la cuenta y genera un link que, al
// abrirlo, establece sesion real y deja al cliente definir su propia contraseña en
// /activar-cuenta — nunca se genera ni se manda una contraseña en texto plano por correo.
export async function sendEnterpriseInviteEmail(
  toEmail: string,
  businessName: string,
  actionLink: string
): Promise<{ sent: boolean; reason?: string; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    console.log(`[Resend NO CONFIGURADO] Invitación Enterprise para ${toEmail}: ${actionLink}`);
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
      subject: "Tu cuenta de Radar IA ya está activa",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h1 style="color:#1a1a1a;font-size:20px;">Radar IA</h1>
          <p style="font-size:15px;color:#333;">Confirmamos tu pago para <strong>${businessName}</strong>. Crea tu contraseña para entrar a tu panel:</p>
          <a href="${actionLink}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#3c78d8;color:#fff;text-decoration:none;border-radius:6px;">
            Activar mi cuenta
          </a>
          <p style="font-size:13px;color:#777;margin-top:24px;">Si no reconoces este pago, contáctanos respondiendo este correo.</p>
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
