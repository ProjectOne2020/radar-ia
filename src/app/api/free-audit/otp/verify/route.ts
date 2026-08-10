import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyOtpCookie, OTP_COOKIE_NAME } from "@/lib/auth/otp";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { freeAuditId, code } = body ?? {};

  if (!freeAuditId || typeof freeAuditId !== "string") {
    return NextResponse.json({ error: "freeAuditId requerido." }, { status: 400 });
  }
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Código requerido." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const otpCookie = cookieStore.get(OTP_COOKIE_NAME)?.value;
  const result = verifyOtpCookie(otpCookie, code);

  if (!result.valid) {
    return NextResponse.json({ error: result.reason ?? "Código inválido." }, { status: 400 });
  }
  if (result.clientId !== freeAuditId) {
    return NextResponse.json({ error: "El código no corresponde a esta solicitud." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("free_audits")
    .update({ whatsapp_verified: true })
    .eq("id", freeAuditId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response = NextResponse.json({ verified: true });
  response.cookies.delete(OTP_COOKIE_NAME);
  return response;
}
