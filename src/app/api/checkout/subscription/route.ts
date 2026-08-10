import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";
import { getRecurringPriceId } from "@/lib/stripe/price-ids";
import type { PlanId } from "@/lib/pricing/plans";

const VALID_PLANS: PlanId[] = ["lite", "plus", "pro"];

// M9 — suscripcion recurrente, SEPARADA del setup fee (mode: subscription).
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

  const priceId = getRecurringPriceId(plan);
  if (!priceId) {
    return NextResponse.json({ error: `No hay price_id recurrente configurado para el plan ${plan}.` }, { status: 500 });
  }

  const stripe = getStripeClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: clientId,
    metadata: { client_id: clientId, plan, type: "subscription" },
    success_url: `${appUrl}/checkout/exito?type=subscription&plan=${plan}`,
    cancel_url: `${appUrl}/checkout/cancelado`,
  });

  return NextResponse.json({ url: session.url });
}
