import type { PlanId } from "@/lib/pricing/plans";

// price_id de cada Product/Price real creado en Stripe (M9, agosto 2026) — cada Price usa
// currency_options para las 6 monedas manuales, Stripe elige la presentment currency segun
// la ubicacion del comprador. Enterprise no tiene entradas: no tiene checkout automatico
// (decision del fundador, ver 01-CONTEXTO-NEGOCIO.md).
export function getRecurringPriceId(plan: PlanId): string | null {
  switch (plan) {
    case "lite":
      return process.env.STRIPE_PRICE_ID_LITE ?? null;
    case "plus":
      return process.env.STRIPE_PRICE_ID_PLUS ?? null;
    case "pro":
      return process.env.STRIPE_PRICE_ID_PRO ?? null;
    default:
      return null;
  }
}

export function getSetupFeePriceId(plan: PlanId): string | null {
  switch (plan) {
    case "lite":
      return process.env.STRIPE_SETUP_FEE_PRICE_ID_LITE ?? null;
    case "plus":
      return process.env.STRIPE_SETUP_FEE_PRICE_ID_PLUS ?? null;
    case "pro":
      return process.env.STRIPE_SETUP_FEE_PRICE_ID_PRO ?? null;
    default:
      return null;
  }
}
