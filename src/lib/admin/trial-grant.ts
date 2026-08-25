import type { createAdminClient } from "@/lib/supabase/admin";

// Pedido puntual del fundador: dar a un cliente especifico (por correo) todos los
// beneficios del plan mas alto, sin pagar, durante exactamente N auditorias completas --
// al terminar la N-esima, vuelve solo a su estado anterior (o a "recien registrado" si
// nunca tuvo plan), sin borrar nada de lo que ya tenia. Nunca se toca Stripe (no se crea
// ninguna suscripcion real) -- se le da el mismo trato que un cliente Pro real en todo lo
// que el resto de la app ya lee de `subscriptions` (cadencia del cron M11, cantidad de
// preguntas al ampliar, badge del dashboard).
export async function grantTemporaryPlan(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
  grantedPlan: string,
  audits: number,
): Promise<{ error?: string }> {
  const { data: existingGrant } = await admin
    .from("trial_grants")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();
  if (existingGrant) return { error: "Este cliente ya tiene un trial activo o previo." };

  const { data: existingSub } = await admin
    .from("subscriptions")
    .select("plan, status, setup_fee_paid, stripe_subscription_id, current_period_end")
    .eq("client_id", clientId)
    .maybeSingle();

  const { error: grantError } = await admin.from("trial_grants").insert({
    client_id: clientId,
    granted_plan: grantedPlan,
    audits_remaining: audits,
    had_subscription: !!existingSub,
    original_plan: existingSub?.plan ?? null,
    original_status: existingSub?.status ?? null,
    original_setup_fee_paid: existingSub?.setup_fee_paid ?? null,
    original_stripe_subscription_id: existingSub?.stripe_subscription_id ?? null,
    original_current_period_end: existingSub?.current_period_end ?? null,
  });
  if (grantError) return { error: grantError.message };

  const { error: subError } = existingSub
    ? await admin
        .from("subscriptions")
        .update({ plan: grantedPlan, status: "active", setup_fee_paid: true })
        .eq("client_id", clientId)
    : await admin
        .from("subscriptions")
        .insert({ client_id: clientId, plan: grantedPlan, status: "active", setup_fee_paid: true });
  if (subError) return { error: subError.message };

  // clients.plan es lo que muestran /admin/clientes y el dashboard del propio cliente —
  // debe reflejar el plan otorgado mientras el trial este activo, igual que
  // upsertSubscription lo mantiene sincronizado para un pago real.
  await admin.from("clients").update({ plan: grantedPlan }).eq("id", clientId);

  return {};
}
