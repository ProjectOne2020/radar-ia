import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertSubscription } from "@/lib/stripe/upsert-subscription";
import type Stripe from "stripe";

// M9 — actualiza subscriptions.status y subscriptions.setup_fee_paid tal como pide
// 03-ARQUITECTURA-TECNICA.md. Verifica la firma (nunca confiar en un webhook sin verificar).
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook no configurado." }, { status: 500 });
  }

  const rawBody = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: `Firma inválida: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const clientId = session.metadata?.client_id;
      const plan = session.metadata?.plan;
      const type = session.metadata?.type;
      if (!clientId || !plan) break;

      if (type === "setup") {
        await upsertSubscription(admin, clientId, plan, { setup_fee_paid: true });
      } else if (type === "subscription" && typeof session.subscription === "string") {
        const stripeSub = await stripe.subscriptions.retrieve(session.subscription);
        await upsertSubscription(admin, clientId, plan, {
          stripe_subscription_id: stripeSub.id,
          status: mapStripeStatus(stripeSub.status),
          current_period_end: getCurrentPeriodEnd(stripeSub),
        });
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const stripeSub = event.data.object as Stripe.Subscription;
      const currentPeriodEnd = getCurrentPeriodEnd(stripeSub);
      await admin
        .from("subscriptions")
        .update({ status: mapStripeStatus(stripeSub.status), current_period_end: currentPeriodEnd })
        .eq("stripe_subscription_id", stripeSub.id);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}

// subscriptions.status en nuestro esquema es 'active' | 'past_due' | 'canceled'
// (03-ARQUITECTURA-TECNICA.md) — Stripe tiene mas estados (trialing, incomplete, etc.),
// se mapean a los 3 documentados en vez de inventar valores nuevos.
function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): string {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "past_due";
    default:
      return "canceled";
  }
}

function getCurrentPeriodEnd(sub: Stripe.Subscription): string | null {
  const item = sub.items.data[0];
  const periodEnd = item?.current_period_end;
  return periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
}
