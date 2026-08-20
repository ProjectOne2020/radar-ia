import { NextResponse, after } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertSubscription } from "@/lib/stripe/upsert-subscription";
import { sendEnterpriseInviteEmail } from "@/lib/enterprise/send-invite-email";
import { upgradeAuditForClient } from "@/lib/audit/upgrade-audit";
import type Stripe from "stripe";

// M9 — actualiza subscriptions.status y subscriptions.setup_fee_paid tal como pide
// 03-ARQUITECTURA-TECNICA.md. Verifica la firma (nunca confiar en un webhook sin verificar).
//
// maxDuration alto (igual que el cron de M11): upgradeAuditForClient corre despues de
// responder a Stripe via after(), pero ese trabajo (hasta 40 preguntas x 4 motores de IA
// reales) sigue contando contra el tiempo de vida de esta invocacion serverless.
export const maxDuration = 300;

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
        // Hueco encontrado por el fundador: pagar nunca ampliaba las preguntas de medicion
        // mas alla de las 5 de la auditoria gratis original. Se corre DESPUES de responder
        // a Stripe (after()) porque puede tardar varios minutos (hasta 40 preguntas x 4
        // motores de IA reales) -- bloquear la respuesta del webhook arriesgaria que Stripe
        // lo de por fallido y reintente el mismo evento.
        after(() => upgradeAuditForClient(admin, clientId, plan));
      } else if (type === "enterprise" && typeof session.subscription === "string") {
        // M24 — el checkout de Enterprise cobra el setup fee y arranca la suscripcion
        // en UNA sola sesion (line items one-time + recurring mezclados), a diferencia
        // de lite/plus/pro donde son dos checkouts separados — asi que aqui se marca
        // setup_fee_paid Y se registra la suscripcion en el mismo evento.
        const stripeSub = await stripe.subscriptions.retrieve(session.subscription);
        await upsertSubscription(admin, clientId, plan, {
          setup_fee_paid: true,
          stripe_subscription_id: stripeSub.id,
          status: mapStripeStatus(stripeSub.status),
          current_period_end: getCurrentPeriodEnd(stripeSub),
        });

        // M31 — hueco encontrado: el cliente Enterprise pagaba pero nunca quedaba con
        // forma de iniciar sesion (a diferencia de lite/plus/pro via /registro-ahora-
        // auditoria-gratis). Se crea la cuenta AQUI, solo tras confirmar el pago real —
        // nunca antes, para no dar de alta cuentas de leads que nunca pagaron. El cliente
        // define su propia contraseña via el link de invitacion (nunca se genera ni se
        // envia una contraseña en texto plano).
        await createEnterpriseAccount(admin, clientId);
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

// M31 — usa el link de invitacion nativo de Supabase Auth (no el mecanismo de OTP+cookie
// de M30, que solo funciona dentro del mismo navegador/paso a paso): el fundador aprueba
// esto desde SU sesion en /admin/empresas, pero quien debe terminar logueado es el cliente
// real, en otro dispositivo por completo. `generateLink` crea la cuenta y devuelve un link
// que, al abrirse, establece sesion real en /activar-cuenta para que el cliente defina su
// propia contraseña.
async function createEnterpriseAccount(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string
): Promise<void> {
  const { data: client } = await admin
    .from("clients")
    .select("email, business_name")
    .eq("id", clientId)
    .single();

  if (!client?.email) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email: client.email,
    options: { redirectTo: `${appUrl}/activar-cuenta` },
  });

  // Si ya existe una cuenta con este correo (ej. este cliente ya habia hecho una
  // auditoria gratis antes y ya tiene login), no se crea una segunda ni se reasigna
  // su client_id — mismo criterio de "una cuenta = un negocio" que M30.
  if (error || !data.user) return;

  const { error: metadataError } = await admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { client_id: clientId },
  });
  if (metadataError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return;
  }

  const actionLink = data.properties?.action_link;
  if (actionLink) {
    await sendEnterpriseInviteEmail(client.email, client.business_name, actionLink);
  }
}
