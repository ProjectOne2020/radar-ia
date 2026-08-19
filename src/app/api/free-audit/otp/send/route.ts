import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateOtpCode, buildOtpCookieValue, OTP_COOKIE_NAME, OTP_TTL_MS } from "@/lib/auth/otp";
import { sendOtpEmail } from "@/lib/free-audit/send-otp-email";
import { getClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit, tooManyRequests } from "@/lib/security/rate-limit";

// Mismo mecanismo de OTP sin DB de M5 (cookie firmada), reutilizado aqui para el flujo
// anonimo de auditoria gratis — usa freeAuditId (no requiere sesion de Supabase Auth).
//
// Endurecido tras la auditoria de seguridad: este endpoint acepta un freeAuditId
// arbitrario y manda un WhatsApp al telefono de ESA solicitud. Sin limite, cualquiera
// podia enviar mensajes ilimitados al numero de otra persona (acoso + costo por
// mensaje de la Cloud API) simplemente repitiendo la llamada con un id ajeno.
const MAX_SENDS_PER_AUDIT = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const freeAuditId = body?.freeAuditId;
  if (!freeAuditId || typeof freeAuditId !== "string") {
    return NextResponse.json({ error: "freeAuditId requerido." }, { status: 400 });
  }

  const ip = getClientIp(request);
  const ipLimit = await consumeRateLimit({
    bucket: "free_audit_otp_send_ip",
    identifier: ip,
    limit: 10,
    windowSeconds: 60 * 60,
  });
  if (!ipLimit.allowed) {
    return tooManyRequests("Demasiados intentos desde esta conexión. Intenta más tarde.", ipLimit.retryAfterSeconds);
  }

  const admin = createAdminClient();
  const { data: freeAudit, error } = await admin
    .from("free_audits")
    .select("phone_whatsapp, otp_sends, otp_last_sent_at, client_id")
    .eq("id", freeAuditId)
    .single();

  if (error || !freeAudit || !freeAudit.phone_whatsapp) {
    return NextResponse.json({ error: "Solicitud de auditoría no encontrada." }, { status: 404 });
  }

  // Canal de verificación: correo (Resend), no WhatsApp — ver send-otp-email.ts. El
  // correo se guarda en clients.email, no en free_audits, así que se busca por client_id
  // (ya enlazado por /api/free-audit/request antes de que el usuario llegue a esta pantalla).
  if (!freeAudit.client_id) {
    return NextResponse.json({ error: "Solicitud de auditoría todavía no está lista." }, { status: 404 });
  }
  const { data: client } = await admin.from("clients").select("email").eq("id", freeAudit.client_id).single();
  if (!client?.email) {
    return NextResponse.json({ error: "Esta solicitud no tiene un correo asociado." }, { status: 404 });
  }

  if ((freeAudit.otp_sends ?? 0) >= MAX_SENDS_PER_AUDIT) {
    return tooManyRequests("Se alcanzó el límite de envíos de código para esta solicitud.");
  }

  if (freeAudit.otp_last_sent_at) {
    const elapsed = Date.now() - new Date(freeAudit.otp_last_sent_at).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      return tooManyRequests(
        "Espera un momento antes de pedir otro código.",
        Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000),
      );
    }
  }

  const code = generateOtpCode();
  // Reutiliza el mismo cookie firmado de M5 — "clientId" aqui es en realidad freeAuditId,
  // el campo es generico (solo un identificador que el verify debe recuperar).
  const cookieValue = buildOtpCookieValue(freeAuditId, freeAudit.phone_whatsapp, code);

  // Se contabiliza el envio y se resetea el contador de intentos ANTES de mandar el
  // mensaje: si el envio falla, el intento igual consumio cuota (evita reintentos
  // infinitos aprovechando un error).
  await admin
    .from("free_audits")
    .update({
      otp_sends: (freeAudit.otp_sends ?? 0) + 1,
      otp_last_sent_at: new Date().toISOString(),
      otp_attempts: 0,
    })
    .eq("id", freeAuditId);

  const { sent, reason } = await sendOtpEmail(client.email, code);

  const response = NextResponse.json({
    sent,
    emailConfigured: sent || reason !== "RESEND_API_KEY/RESEND_FROM_EMAIL no configurados",
  });

  response.cookies.set(OTP_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: OTP_TTL_MS / 1000,
    path: "/",
  });

  return response;
}
