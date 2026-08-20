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

  return {};
}

// Se llama justo despues de que una auditoria termina de verdad (calculateScoreForClient
// ya inserto la fila en ai_visibility_scores) -- si el cliente tiene un trial activo,
// descuenta una auditoria; al llegar a 0, revierte subscriptions a como estaba antes
// (o la borra si nunca tuvo una) y desactiva el trial. No borra clients/locations/
// app_listings/prompt_sets/scores/findings -- solo subscriptions, que es lo que se
// modifico para dar el trial.
export async function consumeTrialAuditIfActive(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
): Promise<void> {
  const { data: grant } = await admin
    .from("trial_grants")
    .select("*")
    .eq("client_id", clientId)
    .eq("active", true)
    .maybeSingle();
  if (!grant) return;

  const remaining = grant.audits_remaining - 1;

  if (remaining > 0) {
    await admin.from("trial_grants").update({ audits_remaining: remaining }).eq("id", grant.id);
    return;
  }

  // had_subscription solo se guarda true cuando grantTemporaryPlan encontro una fila real
  // (plan/status son NOT NULL en esa fila original) -- si por algun motivo llegaran nulos
  // aqui, es un dato corrupto y mejor no tocar subscriptions que dejarlo en un estado
  // invalido a medias.
  if (grant.had_subscription && grant.original_plan && grant.original_status) {
    await admin
      .from("subscriptions")
      .update({
        plan: grant.original_plan,
        status: grant.original_status,
        setup_fee_paid: grant.original_setup_fee_paid,
        stripe_subscription_id: grant.original_stripe_subscription_id,
        current_period_end: grant.original_current_period_end,
      })
      .eq("client_id", clientId);
  } else if (!grant.had_subscription) {
    await admin.from("subscriptions").delete().eq("client_id", clientId);
  }

  await admin.from("trial_grants").update({ audits_remaining: 0, active: false }).eq("id", grant.id);
}
