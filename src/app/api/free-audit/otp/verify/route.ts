import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyOtpCookie, OTP_COOKIE_NAME } from "@/lib/auth/otp";
import { getClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit, tooManyRequests } from "@/lib/security/rate-limit";

// Anti fuerza bruta: el codigo es de 6 digitos (1M combinaciones) y la cookie vive
// 10 minutos. Sin tope de intentos, un atacante que llame /otp/send con el
// freeAuditId de otra persona podia probar codigos en masa hasta acertar y quedarse
// con el reporte ajeno. Ahora hay tope por solicitud y por IP.
const MAX_ATTEMPTS_PER_AUDIT = 5;

// Pedido explicito del fundador: quien completa una auditoria gratis debe quedar
// registrado con una cuenta real (correo+contraseña) que pueda usar despues en /login —
// una sola cuenta por persona, no un registro separado. La cuenta de Supabase Auth se
// crea AQUI, solo cuando el codigo ya se verifico — a proposito, para que crear la cuenta
// (y poder iniciar sesion despues) dependa de haber probado ser dueño del correo. Si la
// cuenta se creara antes (por ejemplo en /api/free-audit/request), cualquiera podria
// saltarse la verificacion entrando directo a /login con la contraseña que puso.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { freeAuditId, code, password } = body ?? {};

  if (!freeAuditId || typeof freeAuditId !== "string") {
    return NextResponse.json({ error: "freeAuditId requerido." }, { status: 400 });
  }
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Código requerido." }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }

  const ip = getClientIp(request);
  const ipLimit = await consumeRateLimit({
    bucket: "free_audit_otp_verify_ip",
    identifier: ip,
    limit: 30,
    windowSeconds: 60 * 60,
  });
  if (!ipLimit.allowed) {
    return tooManyRequests("Demasiados intentos desde esta conexión. Intenta más tarde.", ipLimit.retryAfterSeconds);
  }

  const admin = createAdminClient();
  const { data: freeAudit } = await admin
    .from("free_audits")
    .select("otp_attempts, client_id")
    .eq("id", freeAuditId)
    .single();

  if (!freeAudit) {
    return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 });
  }

  if ((freeAudit.otp_attempts ?? 0) >= MAX_ATTEMPTS_PER_AUDIT) {
    return tooManyRequests("Demasiados intentos con código incorrecto. Solicita un código nuevo.");
  }

  const cookieStore = await cookies();
  const otpCookie = cookieStore.get(OTP_COOKIE_NAME)?.value;
  const result = verifyOtpCookie(otpCookie, code);

  if (!result.valid || result.clientId !== freeAuditId) {
    await admin
      .from("free_audits")
      .update({ otp_attempts: (freeAudit.otp_attempts ?? 0) + 1 })
      .eq("id", freeAuditId);

    // Mensaje generico deliberado: no distinguir "codigo incorrecto" de "el codigo
    // no corresponde a esta solicitud" evita confirmarle a un atacante que un
    // freeAuditId ajeno existe y tiene un OTP pendiente.
    return NextResponse.json({ error: result.reason ?? "Código inválido." }, { status: 400 });
  }

  const { error } = await admin
    .from("free_audits")
    .update({ whatsapp_verified: true, otp_attempts: 0 })
    .eq("id", freeAuditId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let accountCreated = false;
  let email: string | null = null;
  if (freeAudit.client_id) {
    const { data: client } = await admin.from("clients").select("email").eq("id", freeAudit.client_id).single();
    email = client?.email ?? null;

    if (email) {
      const { data: authUser, error: authError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // la verificacion real ya se hizo con el OTP que se acaba de validar
      });

      if (!authError && authUser.user) {
        const { error: metadataError } = await admin.auth.admin.updateUserById(authUser.user.id, {
          app_metadata: { client_id: freeAudit.client_id },
        });
        // Si falla el enlace, no dejar un auth.users huerfano sin client_id (quedaria
        // logueable pero sin negocio asociado, RLS lo bloquearia todo).
        if (metadataError) {
          await admin.auth.admin.deleteUser(authUser.user.id);
        } else {
          accountCreated = true;
        }
      }
      // Si authError es "ya existe una cuenta con este correo" (persona que ya se habia
      // registrado antes, con otra contraseña), no se crea una cuenta nueva ni se
      // reasigna su client_id — cada cuenta de Supabase Auth mapea a un solo negocio.
      // Sigue viendo el reporte igual (ya probo ser dueño del correo con el OTP), solo
      // no se le abre sesion nueva.
    }
  }

  const response = NextResponse.json({ verified: true, accountCreated, email });
  response.cookies.delete(OTP_COOKIE_NAME);
  return response;
}
