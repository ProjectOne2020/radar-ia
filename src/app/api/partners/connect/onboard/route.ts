import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureConnectAccount, createOnboardingLink, isConnectEligible } from "@/lib/stripe/connect";

// Inicia (o continua) el onboarding de Stripe Connect para el partner con sesion activa.
// Solo partners en Mexico pueden llegar aqui con exito -- ver nota en src/lib/stripe/connect.ts.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: partner } = await admin
    .from("partner_accounts")
    .select("id, email, country, stripe_connect_account_id")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!partner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isConnectEligible(partner.country)) {
    return NextResponse.json(
      { error: "Los pagos automáticos solo están disponibles para agencias en México por ahora." },
      { status: 400 },
    );
  }
  if (!partner.email) {
    return NextResponse.json({ error: "Falta el correo de la agencia." }, { status: 400 });
  }

  try {
    const accountId = await ensureConnectAccount(partner.stripe_connect_account_id, partner.email);
    if (accountId !== partner.stripe_connect_account_id) {
      await admin.from("partner_accounts").update({ stripe_connect_account_id: accountId }).eq("id", partner.id);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const url = await createOnboardingLink(
      accountId,
      `${appUrl}/api/partners/connect/refresh`,
      `${appUrl}/api/partners/connect/refresh`,
    );

    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
