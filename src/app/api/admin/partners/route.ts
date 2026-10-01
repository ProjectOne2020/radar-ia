import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin/is-admin";
import { generatePartnerApiKey } from "@/lib/partners/api-key";
import { sendPartnerInviteEmail } from "@/lib/partners/send-partner-email";
import { QUESTION_BANK_COUNTRIES } from "@/lib/question-bank/taxonomy";

// El texto plano de la API key solo se devuelve aqui, en la respuesta de creacion —
// la DB solo guarda el hash (ver src/lib/partners/api-key.ts). Si se pierde, no se
// puede recuperar, solo regenerar (fuera de alcance del primer corte de M13).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { agencyName, email, country, revenueSharePct } = body ?? {};

  if (!agencyName || typeof agencyName !== "string" || agencyName.trim().length < 2) {
    return NextResponse.json({ error: "Nombre de la agencia inválido." }, { status: 400 });
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Correo inválido." }, { status: 400 });
  }
  const validCountryCodes = QUESTION_BANK_COUNTRIES.map((c) => c.code);
  if (typeof country !== "string" || !validCountryCodes.includes(country)) {
    return NextResponse.json({ error: "País inválido." }, { status: 400 });
  }
  if (revenueSharePct !== null && revenueSharePct !== undefined) {
    if (typeof revenueSharePct !== "number" || revenueSharePct < 0 || revenueSharePct > 100) {
      return NextResponse.json({ error: "revenueSharePct debe ser un número entre 0 y 100." }, { status: 400 });
    }
  }

  const { plaintext, hash } = generatePartnerApiKey();
  const admin = createAdminClient();
  const { data: partner, error } = await admin
    .from("partner_accounts")
    .insert({
      agency_name: agencyName.trim(),
      email: email.trim(),
      country,
      revenue_share_pct: revenueSharePct ?? null,
      api_key: hash,
      status: "active",
    })
    .select("id, agency_name, revenue_share_pct, status, created_at")
    .single();

  if (error || !partner) {
    return NextResponse.json({ error: error?.message ?? "No se pudo crear el partner." }, { status: 500 });
  }

  let inviteEmailSent = false;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { data: authData, error: authError } = await admin.auth.admin.generateLink({
    type: "invite",
    email: email.trim(),
    options: { redirectTo: `${appUrl}/partners/activar-cuenta` },
  });

  if (!authError && authData.user) {
    await admin.from("partner_accounts").update({ auth_user_id: authData.user.id }).eq("id", partner.id);
    const actionLink = authData.properties?.action_link;
    if (actionLink) {
      const result = await sendPartnerInviteEmail(email.trim(), partner.agency_name, actionLink);
      inviteEmailSent = result.sent;
    }
  }

  return NextResponse.json({ partner, apiKey: plaintext, inviteEmailSent });
}
