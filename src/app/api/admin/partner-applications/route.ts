import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin/is-admin";
import { generatePartnerApiKey } from "@/lib/partners/api-key";
import { sendPartnerInviteEmail } from "@/lib/partners/send-partner-email";
import { QUESTION_BANK_COUNTRIES } from "@/lib/question-bank/taxonomy";

// Revisa una solicitud de partner (creada por /api/partners/apply): aceptar crea la fila
// real en partner_accounts (mismo mecanismo de API key que la creacion manual existente en
// /admin/partners) y enlaza la solicitud; rechazar solo cambia el estado. Nunca se borra
// una solicitud — queda el registro de que se evaluo, aceptada o no.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { applicationId, action, revenueSharePct, country } = body ?? {};

  if (!applicationId || typeof applicationId !== "string") {
    return NextResponse.json({ error: "applicationId requerido." }, { status: 400 });
  }
  if (action !== "accept" && action !== "reject") {
    return NextResponse.json({ error: "action debe ser 'accept' o 'reject'." }, { status: 400 });
  }
  if (revenueSharePct !== null && revenueSharePct !== undefined) {
    if (typeof revenueSharePct !== "number" || revenueSharePct < 0 || revenueSharePct > 100) {
      return NextResponse.json({ error: "revenueSharePct debe ser un número entre 0 y 100." }, { status: 400 });
    }
  }
  const validCountryCodes = QUESTION_BANK_COUNTRIES.map((c) => c.code);
  if (action === "accept" && (typeof country !== "string" || !validCountryCodes.includes(country))) {
    return NextResponse.json({ error: "País inválido." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: application, error: fetchError } = await admin
    .from("partner_applications")
    .select("id, agency_name, email, status")
    .eq("id", applicationId)
    .single();

  if (fetchError || !application) {
    return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 });
  }
  if (application.status !== "pending") {
    return NextResponse.json({ error: "Esta solicitud ya fue evaluada." }, { status: 409 });
  }

  if (action === "reject") {
    const { error } = await admin
      .from("partner_applications")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", applicationId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ status: "rejected" });
  }

  const { plaintext, hash } = generatePartnerApiKey();
  const { data: partner, error: partnerError } = await admin
    .from("partner_accounts")
    .insert({
      agency_name: application.agency_name,
      email: application.email,
      country,
      revenue_share_pct: revenueSharePct ?? null,
      api_key: hash,
      status: "active",
    })
    .select("id, agency_name")
    .single();

  if (partnerError || !partner) {
    return NextResponse.json({ error: partnerError?.message ?? "No se pudo crear el partner." }, { status: 500 });
  }

  const { error: updateError } = await admin
    .from("partner_applications")
    .update({ status: "accepted", partner_account_id: partner.id, reviewed_at: new Date().toISOString() })
    .eq("id", applicationId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Cuenta de acceso al panel de agencia — mismo mecanismo que createEnterpriseAccount en
  // el webhook de Stripe (generateLink type "invite", nunca una contraseña en texto plano).
  // Si falla el envio del correo no se revierte la creacion del partner: la API key sigue
  // siendo el acceso de respaldo, y el admin puede reenviar el link despues.
  let inviteEmailSent = false;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { data: authData, error: authError } = await admin.auth.admin.generateLink({
    type: "invite",
    email: application.email,
    options: { redirectTo: `${appUrl}/partners/activar-cuenta` },
  });

  if (!authError && authData.user) {
    await admin.from("partner_accounts").update({ auth_user_id: authData.user.id }).eq("id", partner.id);
    const actionLink = authData.properties?.action_link;
    if (actionLink) {
      const result = await sendPartnerInviteEmail(application.email, partner.agency_name, actionLink);
      inviteEmailSent = result.sent;
    }
  }

  return NextResponse.json({ status: "accepted", partner, apiKey: plaintext, inviteEmailSent });
}
