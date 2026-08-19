import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin/is-admin";
import { isManualCurrency } from "@/lib/pricing/plans";
import { getStripeClient } from "@/lib/stripe/client";
import { toStripeUnitAmount } from "@/lib/stripe/unit-amount";

// M24 — panel de admin para el flujo Enterprise ("cotice, aprueba y cobre" pedido
// explicitamente por el fundador): una solicitud de /empresas llega como
// enterprise_leads.status='pending'; el fundador la cotiza (fija setup + mensual en
// una de las 6 monedas manuales), y al aprobar se genera UN link de pago de Stripe que
// cobra el setup fee y arranca la suscripcion mensual en el mismo checkout (mode:
// subscription admite line items one-time + recurring mezclados). El webhook existente
// de /api/webhooks/stripe ya sabe marcar setup_fee_paid + crear la suscripcion — aqui
// solo se le agrega el tipo "enterprise" a esa misma logica.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { leadId, action } = body ?? {};

  if (!leadId || typeof leadId !== "string") {
    return NextResponse.json({ error: "leadId requerido." }, { status: 400 });
  }
  if (action !== "quote" && action !== "reject" && action !== "charge") {
    return NextResponse.json({ error: "action debe ser 'quote', 'reject' o 'charge'." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: lead, error: fetchError } = await admin
    .from("enterprise_leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (fetchError || !lead) {
    return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 });
  }

  if (action === "reject") {
    if (lead.status === "approved") {
      return NextResponse.json({ error: "Esta solicitud ya fue aprobada y cobrada." }, { status: 409 });
    }
    const { error } = await admin.from("enterprise_leads").update({ status: "rejected" }).eq("id", leadId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ status: "rejected" });
  }

  if (action === "quote") {
    if (lead.status === "approved") {
      return NextResponse.json({ error: "Esta solicitud ya fue aprobada y cobrada." }, { status: 409 });
    }
    const { currency, setupFee, recurringFee } = body;
    if (!isManualCurrency(currency)) {
      return NextResponse.json({ error: "Moneda inválida." }, { status: 400 });
    }
    if (typeof setupFee !== "number" || setupFee < 0 || typeof recurringFee !== "number" || recurringFee <= 0) {
      return NextResponse.json(
        { error: "setupFee y recurringFee deben ser números; recurringFee debe ser mayor a 0." },
        { status: 400 },
      );
    }
    const { error } = await admin
      .from("enterprise_leads")
      .update({
        status: "quoted",
        currency,
        quoted_setup_fee: setupFee,
        quoted_recurring_fee: recurringFee,
        quoted_at: new Date().toISOString(),
      })
      .eq("id", leadId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ status: "quoted" });
  }

  // action === "charge"
  if (lead.status !== "quoted") {
    return NextResponse.json({ error: "La solicitud debe estar cotizada antes de generar el cobro." }, { status: 409 });
  }
  if (!lead.currency || !isManualCurrency(lead.currency) || lead.quoted_setup_fee === null || lead.quoted_recurring_fee === null) {
    return NextResponse.json({ error: "Falta completar la cotización." }, { status: 400 });
  }

  let clientId = lead.client_id;
  if (!clientId) {
    const { data: client, error: clientError } = await admin
      .from("clients")
      .insert({
        business_name: lead.business_name,
        niche: "enterprise",
        plan: "enterprise",
        country: lead.country ?? "MX",
        currency: lead.currency,
        phone_whatsapp: lead.phone_whatsapp,
        email: lead.email,
        verification_status: "verified", // onboarding asistido: ya hubo contacto humano, no aplica el OTP de auditoria gratis
        onboarding_type: "assisted",
      })
      .select("id")
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: `No se pudo crear el negocio: ${clientError?.message}` }, { status: 500 });
    }
    clientId = client.id;
  }

  const stripe = getStripeClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const currency = lead.currency.toLowerCase();

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  if (lead.quoted_setup_fee > 0) {
    lineItems.push({
      price_data: {
        currency,
        product_data: { name: `Configuración inicial Enterprise — ${lead.business_name}` },
        unit_amount: toStripeUnitAmount(lead.quoted_setup_fee, lead.currency),
      },
      quantity: 1,
    });
  }
  lineItems.push({
    price_data: {
      currency,
      product_data: { name: `Plan Enterprise — ${lead.business_name}` },
      unit_amount: toStripeUnitAmount(lead.quoted_recurring_fee, lead.currency),
      recurring: { interval: "month" },
    },
    quantity: 1,
  });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: lineItems,
    client_reference_id: clientId,
    customer_email: lead.email,
    metadata: { client_id: clientId, plan: "enterprise", type: "enterprise", enterprise_lead_id: lead.id },
    success_url: `${appUrl}/checkout/exito?type=subscription&plan=enterprise`,
    cancel_url: `${appUrl}/checkout/cancelado`,
  });

  const { error: updateError } = await admin
    .from("enterprise_leads")
    .update({ status: "approved", client_id: clientId, checkout_url: session.url, approved_at: new Date().toISOString() })
    .eq("id", leadId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ status: "approved", checkoutUrl: session.url, clientId });
}
