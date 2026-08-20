import type { createAdminClient } from "@/lib/supabase/admin";

export interface SubscriptionFields {
  status?: string;
  setup_fee_paid?: boolean;
  stripe_subscription_id?: string;
  current_period_end?: string | null;
}

// subscriptions no tiene constraint unique en client_id (esquema literal de
// 03-ARQUITECTURA-TECNICA.md), asi que el "upsert" es logica de aplicacion: busca la fila
// existente del cliente y la actualiza, o crea una nueva.
export async function upsertSubscription(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
  plan: string,
  fields: SubscriptionFields
) {
  const { data: existing } = await admin.from("subscriptions").select("id").eq("client_id", clientId).maybeSingle();

  if (existing) {
    // `plan` se actualiza tambien: antes solo se aplicaban `fields` y el plan de una
    // fila existente quedaba congelado en el primero que se hubiera creado. Eso dejaba
    // la DB desincronizada de lo que el cliente realmente pago en Stripe (y el cron de
    // re-medicion usa subscriptions.plan para decidir la frecuencia).
    await admin
      .from("subscriptions")
      .update({ ...fields, plan })
      .eq("id", existing.id);
  } else {
    await admin.from("subscriptions").insert({
      client_id: clientId,
      plan,
      status: fields.status ?? "incomplete",
      setup_fee_paid: fields.setup_fee_paid ?? false,
      stripe_subscription_id: fields.stripe_subscription_id,
      current_period_end: fields.current_period_end,
    });
  }

  // clients.plan tambien se mantenia congelado en "lite" (el valor puesto al registrarse)
  // para siempre, sin importar lo que el cliente realmente pagara despues — el panel de
  // admin (y cualquier otra pantalla que lea clients.plan en vez de subscriptions.plan)
  // mostraba un plan viejo. subscriptions.plan es la fuente de verdad; clients.plan debe
  // reflejarla siempre que cambie.
  await admin.from("clients").update({ plan }).eq("id", clientId);
}
