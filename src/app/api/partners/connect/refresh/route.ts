import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConnectAccountStatus } from "@/lib/stripe/connect";

// Return/refresh URL del Account Link de Stripe (ver /api/partners/connect/onboard) --
// mismo destino para ambos casos (termino el onboarding o lo abandono a medias), Stripe no
// distingue uno de otro en la redireccion. Siempre se re-consulta el estado real contra la
// API de Stripe antes de actualizar la fila, nunca se asume que "volver" significa "termino".
export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(`${appUrl}/partners/login`);

  const admin = createAdminClient();
  const { data: partner } = await admin
    .from("partner_accounts")
    .select("id, stripe_connect_account_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (partner?.stripe_connect_account_id) {
    try {
      const status = await getConnectAccountStatus(partner.stripe_connect_account_id);
      await admin.from("partner_accounts").update({ connect_onboarding_status: status }).eq("id", partner.id);
    } catch {
      // Si Stripe no responde, se deja el estado como estaba -- el partner puede
      // reintentar el onboarding desde el dashboard.
    }
  }

  return NextResponse.redirect(`${appUrl}/partners/dashboard`);
}
