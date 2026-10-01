import { getStripeClient } from "./client";

// Pagos automaticos via Stripe Connect SOLO son viables para partners en Mexico: la cuenta
// de Stripe de Radar IA esta registrada en MX, y Stripe no permite transferencias
// transfronterizas self-serve desde una plataforma mexicana hacia cuentas conectadas en
// otros paises (verificado contra la API real de Stripe y su documentacion antes de
// construir esto). Mismo pais (MX -> MX) si es un caso estandar de Connect.
export const CONNECT_ELIGIBLE_COUNTRY = "MX";

export function isConnectEligible(country: string | null): boolean {
  return country === CONNECT_ELIGIBLE_COUNTRY;
}

// Crea la cuenta conectada Express si el partner todavia no tiene una. Express porque el
// onboarding (KYC, datos bancarios) lo hace Stripe en su propia UI hospedada -- sin esto
// Radar IA tendria que construir y mantener esos formularios (Custom) o pedirle a cada
// agencia que administre su propia cuenta completa de Stripe (Standard), ninguno de los
// dos tiene sentido para un equipo de un solo fundador.
export async function ensureConnectAccount(
  existingAccountId: string | null,
  email: string,
): Promise<string> {
  if (existingAccountId) return existingAccountId;

  const stripe = getStripeClient();
  const account = await stripe.accounts.create({
    type: "express",
    country: CONNECT_ELIGIBLE_COUNTRY,
    email,
    capabilities: { transfers: { requested: true } },
    business_type: "company",
  });
  return account.id;
}

export async function createOnboardingLink(accountId: string, returnUrl: string, refreshUrl: string): Promise<string> {
  const stripe = getStripeClient();
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: returnUrl,
    refresh_url: refreshUrl,
  });
  return link.url;
}

export async function getConnectAccountStatus(accountId: string): Promise<"not_started" | "pending" | "complete"> {
  const stripe = getStripeClient();
  const account = await stripe.accounts.retrieve(accountId);
  if (account.payouts_enabled && account.charges_enabled) return "complete";
  if (account.details_submitted) return "pending";
  return "not_started";
}
