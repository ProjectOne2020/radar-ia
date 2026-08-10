import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyOtpCookie, OTP_COOKIE_NAME } from "@/lib/auth/otp";

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

  // Update via RLS del propio usuario (ejercita la policy clients_update_own de M1) — no
  // se usa admin aqui a proposito, es la prueba en vivo de que la sesion quedo bien enlazada.
  const { error: updateError } = await supabase
    .from("clients")
    .update({ verification_status: "verified" })
    .eq("id", clientId);

  if (updateError) {
    // Si RLS bloqueo el update, algo esta mal con el enlace de sesion -> client_id.
    // Fallback con admin para no dejar al usuario atorado, pero se reporta el error real.
    const admin = createAdminClient();
    const { error: adminUpdateError } = await admin
      .from("clients")
      .update({ verification_status: "verified" })
      .eq("id", clientId);

    if (adminUpdateError) {
      return NextResponse.json({ error: adminUpdateError.message }, { status: 500 });
    }

    const response = NextResponse.json({
      verified: true,
      warning: `El update via RLS del usuario falló (${updateError.message}) — se aplicó con service_role. Revisar el enlace de sesión.`,
    });
    response.cookies.delete(OTP_COOKIE_NAME);
    return response;
  }

  const response = NextResponse.json({ verified: true });
  response.cookies.delete(OTP_COOKIE_NAME);
  return response;
}
