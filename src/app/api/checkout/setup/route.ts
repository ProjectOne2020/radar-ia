import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/client";
import { getSetupFeePriceId } from "@/lib/stripe/price-ids";
import { getSetupFee, type PlanId } from "@/lib/pricing/plans";
import { isManualCurrency } from "@/lib/pricing/plans";
import { upsertSubscription } from "@/lib/stripe/upsert-subscription";

const VALID_PLANS: PlanId[] = ["lite", "plus", "pro"]; // enterprise no tiene checkout

// M9 — cargo de setup fee, SEPARADO de la suscripcion (mode: payment, no mode: subscription
// — 03-ARQUITECTURA-TECNICA.md es explicito en no combinarlos en un solo objeto).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });

  const clientId = user.app_metadata?.client_id as string | undefined;
  if (!clientId) return NextResponse.json({ error: "La sesión no está enlazada a un negocio." }, { status: 400 });

  const body = await request.json().catch(() => null);
  const plan = body?.plan as PlanId;
  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: "Plan inválido para checkout automático." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("currency, onboarding_type")
    .eq("id", clientId)
    .single();

  if (clientError || !client) return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 });

  const currency = isManualCurrency(client.currency) ? client.currency : "MXN";
  const onboardingType = (client.onboarding_type as "self_serve" | "assisted") ?? "self_serve";
  const setupFee = getSetupFee(plan, currency, onboardingType);

  // Lite self-serve = $0 de setup: no hay nada que cobrar, se marca pagado directo.
  if (setupFee === 0) {
    await upsertSubscription(admin, clientId, plan, { setup_fee_paid: true });
    return NextResponse.json({ skipped: true, nextStep: "subscription" });
  }

  const priceId = getSetupFeePriceId(plan);
  if (!priceId) {
    return NextResponse.json({ error: `No hay price_id de setup configurado para el plan ${plan}.` }, { status: 500 });
  }

  const stripe = getStripeClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: clientId,
    metadata: { client_id: clientId, plan, type: "setup" },
    success_url: `${appUrl}/checkout/exito?type=setup&plan=${plan}`,
    cancel_url: `${appUrl}/checkout/cancelado`,
  });

  return NextResponse.json({ url: session.url });
}
