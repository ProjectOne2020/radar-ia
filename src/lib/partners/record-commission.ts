import type { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/client";
import { isConnectEligible } from "@/lib/stripe/connect";

interface RecordCommissionParams {
  clientId: string;
  stripeEventId: string;
  amountTotal: number | null;
  currency: string | null;
}

// Se llama desde el webhook de Stripe en checkout.session.completed (setup fee, primer pago
// de suscripcion, o Enterprise) -- cubre la ADQUISICION del cliente, no las renovaciones
// recurrentes (eso requeriria escuchar invoice.payment_succeeded, fuera de alcance de este
// primer corte; documentado explicitamente para no prometer algo que no se construyo).
//
// Nunca lanza: se llama via after() desde el webhook, un fallo aqui no debe afectar el
// procesamiento del pago real del cliente. stripe_event_id es la clave de idempotencia --
// un reintento del webhook de Stripe no duplica la comision (23505 = ya se proceso este
// evento, se ignora en silencio).
export async function recordCommissionForPayment(
  admin: ReturnType<typeof createAdminClient>,
  { clientId, stripeEventId, amountTotal, currency }: RecordCommissionParams,
): Promise<void> {
  try {
    if (!amountTotal || amountTotal <= 0 || !currency) return;

    const { data: client } = await admin.from("clients").select("partner_id").eq("id", clientId).maybeSingle();
    if (!client?.partner_id) return;

    const { data: partner } = await admin
      .from("partner_accounts")
      .select("id, revenue_share_pct, country, stripe_connect_account_id, connect_onboarding_status")
      .eq("id", client.partner_id)
      .maybeSingle();
    if (!partner || !partner.revenue_share_pct || partner.revenue_share_pct <= 0) return;

    const commissionAmount = Math.round((amountTotal * partner.revenue_share_pct) / 100);
    if (commissionAmount <= 0) return;

    const { data: commission, error: insertError } = await admin
      .from("partner_commissions")
      .insert({
        partner_id: partner.id,
        client_id: clientId,
        stripe_event_id: stripeEventId,
        amount: commissionAmount,
        currency,
        status: "pending_manual",
      })
      .select("id")
      .single();

    // 23505 = unique_violation en stripe_event_id: este evento ya genero su comision
    // (reintento del webhook). No es un error real, se ignora.
    if (insertError || !commission) return;

    const canAutoPay =
      isConnectEligible(partner.country) &&
      partner.connect_onboarding_status === "complete" &&
      !!partner.stripe_connect_account_id;

    if (!canAutoPay) return;

    try {
      const stripe = getStripeClient();
      await stripe.transfers.create({
        amount: commissionAmount,
        currency,
        destination: partner.stripe_connect_account_id!,
        transfer_group: stripeEventId,
      });
      await admin
        .from("partner_commissions")
        .update({ status: "paid_auto", paid_at: new Date().toISOString() })
        .eq("id", commission.id);
    } catch {
      // La transferencia fallo (ej. el estado guardado estaba desactualizado) -- la
      // comision ya quedo registrada como pending_manual, el fundador la paga a mano.
    }
  } catch {
    // Nunca debe tumbar el webhook de Stripe.
  }
}
