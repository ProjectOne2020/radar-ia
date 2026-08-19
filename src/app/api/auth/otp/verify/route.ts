import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyOtpCookie, OTP_COOKIE_NAME } from "@/lib/auth/otp";
import { getClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit, tooManyRequests } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const code = body?.code;
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Código requerido." }, { status: 400 });
  }

  // Anti fuerza bruta del codigo de 6 digitos, por usuario (no por IP: el atacante
  // aqui ya tiene sesion propia, rotar IP no le sirve para escapar de este limite).
  const attemptLimit = await consumeRateLimit({
    bucket: "auth_otp_verify_user",
    identifier: user.id,
    limit: 10,
    windowSeconds: 60 * 60,
  });
  if (!attemptLimit.allowed) {
    return tooManyRequests(
      "Demasiados intentos con código incorrecto. Solicita un código nuevo más tarde.",
      attemptLimit.retryAfterSeconds,
    );
  }

  const cookieStore = await cookies();
  const otpCookie = cookieStore.get(OTP_COOKIE_NAME)?.value;
  const result = verifyOtpCookie(otpCookie, code);

  if (!result.valid) {
    return NextResponse.json({ error: result.reason ?? "Código inválido." }, { status: 400 });
  }

  const clientId = user.app_metadata?.client_id as string | undefined;
  if (!clientId || clientId !== result.clientId) {
    return NextResponse.json({ error: "El código no corresponde a esta sesión." }, { status: 400 });
  }

  // Se escribe con service_role a proposito. Antes esto se hacia con el cliente del
  // usuario (via la policy clients_update_own) "como prueba de que la sesion quedo
  // enlazada" — pero esa misma policy le permitia al usuario poner
  // verification_status='verified' por su cuenta desde el navegador, saltandose el
  // OTP por completo. El permiso de UPDATE sobre clients se revoco del rol
  // authenticated; la verificacion solo puede aplicarla el servidor, y solo despues
  // de validar el codigo real.
  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("clients")
    .update({ verification_status: "verified" })
    .eq("id", clientId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const response = NextResponse.json({ verified: true });
  response.cookies.delete(OTP_COOKIE_NAME);
  return response;
}
