import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin/is-admin";
import { getStripeClient } from "@/lib/stripe/client";

// Cancela al final del periodo ya pagado (nunca de inmediato): el cliente ya pago ese
// ciclo, cortarle el acceso a mitad de periodo seria quitarle algo que ya pago. El
// webhook de Stripe (customer.subscription.updated) sincroniza subscriptions.status
// solo — esta ruta nunca escribe en la tabla directamente, para no tener dos fuentes
// de verdad que puedan desincronizarse.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { clientId } = body ?? {};
  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json({ error: "clientId requerido" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("client_id", clientId)
    .maybeSingle();

  if (!sub?.stripe_subscription_id) {
    return NextResponse.json({ error: "Este cliente no tiene una suscripción de Stripe." }, { status: 404 });
  }
  if (sub.status === "canceled") {
    return NextResponse.json({ error: "La suscripción ya está cancelada." }, { status: 400 });
  }

  try {
    const stripe = getStripeClient();
    await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
