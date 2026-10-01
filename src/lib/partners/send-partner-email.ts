// Mismo patron que sendEnterpriseInviteEmail (src/lib/enterprise/send-invite-email.ts):
// Resend, nunca una contraseña en texto plano, el link de Supabase Auth hace todo el
// trabajo de sesion. Dos variantes: invitacion (primera vez, define contraseña) y login
// (ya tiene cuenta, pide un link nuevo para esta sesion).

async function sendViaResend(toEmail: string, subject: string, html: string): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    console.log(`[Resend NO CONFIGURADO] Correo para ${toEmail}, asunto "${subject}"`);
    return { sent: false, reason: "RESEND_API_KEY/RESEND_FROM_EMAIL no configurados" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from: `Radar IA <${fromEmail}>`, to: [toEmail], subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[Resend ERROR] ${res.status}: ${body}`);
    return { sent: false, reason: `Resend API error ${res.status}` };
  }
  return { sent: true };
}

export async function sendPartnerInviteEmail(toEmail: string, agencyName: string, actionLink: string) {
  return sendViaResend(
    toEmail,
    "Tu cuenta de partner de Radar IA ya está activa",
    `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h1 style="color:#1a1a1a;font-size:20px;">Radar IA</h1>
        <p style="font-size:15px;color:#333;">Aprobamos a <strong>${agencyName}</strong> como partner de Radar IA. Crea tu contraseña para entrar a tu panel de agencia:</p>
        <a href="${actionLink}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#3c78d8;color:#fff;text-decoration:none;border-radius:6px;">
          Activar mi panel
        </a>
        <p style="font-size:13px;color:#777;margin-top:24px;">Si no reconoces esta invitación, ignora este correo.</p>
      </div>
    `,
  );
}

export async function sendPartnerLoginEmail(toEmail: string, actionLink: string) {
  return sendViaResend(
    toEmail,
    "Tu link para entrar al panel de Radar IA",
    `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h1 style="color:#1a1a1a;font-size:20px;">Radar IA</h1>
        <p style="font-size:15px;color:#333;">Entra a tu panel de agencia con este link (válido por un tiempo limitado):</p>
        <a href="${actionLink}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#3c78d8;color:#fff;text-decoration:none;border-radius:6px;">
          Entrar a mi panel
        </a>
        <p style="font-size:13px;color:#777;margin-top:24px;">Si no pediste este link, ignora este correo.</p>
      </div>
    `,
  );
}
