import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateOtpCode, buildOtpCookieValue, OTP_COOKIE_NAME, OTP_TTL_MS } from "@/lib/auth/otp";
import { sendWhatsAppText } from "@/lib/whatsapp/send-message";

// Mismo mecanismo de OTP sin DB de M5 (cookie firmada), reutilizado aqui para el flujo
// anonimo de auditoria gratis — usa freeAuditId (no requiere sesion de Supabase Auth).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const freeAuditId = body?.freeAuditId;
  if (!freeAuditId || typeof freeAuditId !== "string") {
    return NextResponse.json({ error: "freeAuditId requerido." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: freeAudit, error } = await admin
    .from("free_audits")
    .select("phone_whatsapp")
    .eq("id", freeAuditId)
    .single();

  if (error || !freeAudit || !freeAudit.phone_whatsapp) {
    return NextResponse.json({ error: "Solicitud de auditoría no encontrada." }, { status: 404 });
  }

  const code = generateOtpCode();
  // Reutiliza el mismo cookie firmado de M5 — "clientId" aqui es en realidad freeAuditId,
  // el campo es generico (solo un identificador que el verify debe recuperar).
  const cookieValue = buildOtpCookieValue(freeAuditId, freeAudit.phone_whatsapp, code);

  const { sent, reason } = await sendWhatsAppText(
    freeAudit.phone_whatsapp,
    `Radar IA: tu código para ver tu auditoría gratis es ${code}. Vence en 10 minutos.`
  );

  const response = NextResponse.json({
    sent,
    whatsappConfigured: sent || reason !== "WHATSAPP_CLOUD_API_TOKEN/PHONE_NUMBER_ID no configurados",
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
