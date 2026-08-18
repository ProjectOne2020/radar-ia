// Precios literales dados por el fundador (agosto 2026) — ver 01-CONTEXTO-NEGOCIO.md
// seccion 4 para la tabla completa y las notas. NO ajustar/inventar numeros aqui sin
// confirmar con el fundador primero (regla no negociable #2 de 00-README.md).

export type PlanId = "lite" | "plus" | "pro" | "enterprise";
export type ManualCurrency = "MXN" | "COP" | "CLP" | "PEN" | "ARS" | "BRL";

export const MANUAL_CURRENCIES: ManualCurrency[] = ["MXN", "COP", "CLP", "PEN", "ARS", "BRL"];

export interface PlanInfo {
  id: PlanId;
  name: string;
  flagship?: boolean;
  hasStripeCheckout: boolean; // false = Enterprise, "Contactar para cotizacion"
  featuresKey: string; // clave en el namespace Precios de messages/*.json (ver seccion 4 de 01-CONTEXTO-NEGOCIO.md)
}

export const PLANS: PlanInfo[] = [
  { id: "lite", name: "Lite", hasStripeCheckout: true, featuresKey: "featuresLite" },
  { id: "plus", name: "Plus", flagship: true, hasStripeCheckout: true, featuresKey: "featuresPlus" },
  { id: "pro", name: "Pro", hasStripeCheckout: true, featuresKey: "featuresPro" },
  { id: "enterprise", name: "Enterprise", hasStripeCheckout: false, featuresKey: "featuresEnterprise" },
];

// Setup fee (pago unico). Lite: este valor aplica SOLO a onboarding asistido — el
// self-serve es $0 (ver getSetupFee). Enterprise: sin Price de Stripe, no aplica.
const SETUP_FEES: Record<Exclude<PlanId, "enterprise">, Record<ManualCurrency, number>> = {
  lite: { MXN: 499, COP: 89900, CLP: 26900, PEN: 99, ARS: 43900, BRL: 149 },
  plus: { MXN: 1349, COP: 249900, CLP: 72900, PEN: 275, ARS: 118900, BRL: 399 },
  pro: { MXN: 5999, COP: 1099900, CLP: 319900, PEN: 1199, ARS: 524900, BRL: 1799 },
};

const RECURRING_FEES: Record<Exclude<PlanId, "enterprise">, Record<ManualCurrency, number>> = {
  lite: { MXN: 159, COP: 29900, CLP: 8290, PEN: 32, ARS: 13900, BRL: 47 },
  plus: { MXN: 499, COP: 89900, CLP: 26900, PEN: 99, ARS: 43900, BRL: 149 },
  pro: { MXN: 1699, COP: 309900, CLP: 90900, PEN: 349, ARS: 148900, BRL: 499 },
};

// Lite self-serve = $0 de setup (01-CONTEXTO-NEGOCIO.md: "$0 onboarding autoguiado o
// $29-49 USD lo hace el equipo") — el precio de la tabla es solo para onboarding asistido.
export function getSetupFee(
  plan: PlanId,
  currency: ManualCurrency,
  onboardingType: "self_serve" | "assisted"
): number | null {
  if (plan === "enterprise") return null;
  if (plan === "lite" && onboardingType === "self_serve") return 0;
  return SETUP_FEES[plan][currency];
}

export function getRecurringFee(plan: PlanId, currency: ManualCurrency): number | null {
  if (plan === "enterprise") return null;
  return RECURRING_FEES[plan][currency];
}

export function isManualCurrency(currency: string): currency is ManualCurrency {
  return (MANUAL_CURRENCIES as string[]).includes(currency);
}
