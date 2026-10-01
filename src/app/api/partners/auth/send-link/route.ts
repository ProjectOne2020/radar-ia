import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPartnerLoginEmail } from "@/lib/partners/send-partner-email";

// Login de agencias: sin password que ellas elijan desde cero (la cuenta se crea solo al
// aprobarlas, via invite link). Para volver a entrar piden un link nuevo aqui — mismo
// generateLink de Supabase, tipo "magiclink" en vez de "invite" porque la cuenta ya existe.
// Respuesta identica exista o no el correo (no revelar que agencias son partners de Radar IA).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { email } = body ?? {};

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Correo inválido." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: partner } = await admin
    .from("partner_accounts")
    .select("id, agency_name")
    .eq("email", email.trim())
    .eq("status", "active")
    .maybeSingle();

  if (partner) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const { data: authData, error: authError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: email.trim(),
      options: { redirectTo: `${appUrl}/partners/dashboard` },
    });

    const actionLink = authData?.properties?.action_link;
    if (!authError && actionLink) {
      await sendPartnerLoginEmail(email.trim(), actionLink);
    }
  }

  return NextResponse.json({ ok: true });
}
