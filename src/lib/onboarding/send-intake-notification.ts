// Notifica al equipo (ADMIN_EMAILS, mismo patron que src/lib/admin/is-admin.ts) cuando un
// cliente llena el formulario de "que necesitamos para implementar" (M37/onboarding_intake)
// -- antes quedaba solo guardado en la tabla, sin ninguna forma de que el equipo se
// enterara para arrancar la implementacion. Mismo patron REST directo a Resend que el
// resto de correos del proyecto (ver src/lib/free-audit/send-otp-email.ts).
export async function sendIntakeNotification(data: {
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  websitePlatform: string | null;
  websiteAccessMethod: string | null;
  inviteEmail: string | null;
  hasGbp: boolean | null;
  gbpNotes: string | null;
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (!apiKey || !fromEmail || adminEmails.length === 0) {
    return { sent: false, reason: "RESEND_API_KEY/RESEND_FROM_EMAIL/ADMIN_EMAILS no configurados" };
  }

  const accessMethodLabel =
    data.websiteAccessMethod === "invite_us"
      ? `Invitar como editor/admin (correo: ${data.inviteEmail ?? "—"})`
      : data.websiteAccessMethod === "we_apply_changes"
        ? "El cliente aplica los cambios que le indiquemos"
        : "—";

  const gbpLabel = data.hasGbp === true ? "Sí" : data.hasGbp === false ? "No / no está seguro" : "—";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: `Radar IA <${fromEmail}>`,
      to: adminEmails,
      subject: `Nuevo formulario de implementación — ${data.businessName}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
          <h1 style="color:#1a1a1a;font-size:18px;">Nuevo formulario de implementación</h1>
          <p style="font-size:14px;color:#333;"><strong>Negocio:</strong> ${data.businessName}</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">
            <tr><td style="padding:4px 8px;color:#555;">Contacto</td><td style="padding:4px 8px;">${data.contactName} — ${data.contactEmail}${data.contactPhone ? ` — ${data.contactPhone}` : ""}</td></tr>
            <tr><td style="padding:4px 8px;color:#555;">Plataforma del sitio</td><td style="padding:4px 8px;">${data.websitePlatform ?? "—"}</td></tr>
            <tr><td style="padding:4px 8px;color:#555;">Acceso al sitio</td><td style="padding:4px 8px;">${accessMethodLabel}</td></tr>
            <tr><td style="padding:4px 8px;color:#555;">Google Business Profile</td><td style="padding:4px 8px;">${gbpLabel}${data.gbpNotes ? ` — ${data.gbpNotes}` : ""}</td></tr>
          </table>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[Resend ERROR] ${res.status}: ${body}`);
    return { sent: false, reason: `Resend API error ${res.status}: ${body}` };
  }

  return { sent: true };
}
