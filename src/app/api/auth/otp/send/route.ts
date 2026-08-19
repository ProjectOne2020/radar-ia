import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateOtpCode, buildOtpCookieValue, OTP_COOKIE_NAME, OTP_TTL_MS } from "@/lib/auth/otp";
import { sendWhatsAppText } from "@/lib/whatsapp/send-message";
import { consumeRateLimit, tooManyRequests } from "@/lib/security/rate-limit";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });
  }

  const clientId = user.app_metadata?.client_id as string | undefined;
  if (!clientId) {
    return NextResponse.json({ error: "La sesión no está enlazada a un negocio." }, { status: 400 });
  }

  // Cada envio cuesta un mensaje de la Cloud API de WhatsApp. Sin tope, una cuenta
  // podia disparar envios ilimitados a su propio numero (costo) en bucle.
  const sendLimit = await consumeRateLimit({
    bucket: "auth_otp_send_user",
    identifier: user.id,
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (!sendLimit.allowed) {
    return tooManyRequests("Demasiados códigos solicitados. Intenta más tarde.", sendLimit.retryAfterSeconds);
  }

  const { data: client, error } = await supabase
    .from("clients")
    .select("phone_whatsapp, business_name")
    .eq("id", clientId)
    .single();

  if (error || !client) {
    return NextResponse.json({ error: "No se encontró el negocio de esta cuenta." }, { status: 404 });
  }

  const code = generateOtpCode();
  const cookieValue = buildOtpCookieValue(clientId, client.phone_whatsapp, code);

  const { sent, reason } = await sendWhatsAppText(
    client.phone_whatsapp,
    `Radar IA: tu código de verificación es ${code}. Vence en 10 minutos.`
  );

  const response = NextResponse.json({
    sent,
    // whatsappConfigured=false es informativo para dev/QA (nunca se manda el codigo aqui) —
    // el codigo real solo viaja por WhatsApp o queda en logs de servidor si no hay credenciales.
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
