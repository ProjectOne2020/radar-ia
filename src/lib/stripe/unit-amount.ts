// Stripe espera el monto en la unidad minima de la moneda, pero no todas las monedas
// tienen 2 decimales ahi: CLP es "zero-decimal" en Stripe (1 CLP = 1 unidad, no 100).
// De nuestras 6 monedas manuales, solo CLP esta en esa lista — ver
// https://docs.stripe.com/currencies#zero-decimal. Los precios ya creados en el
// dashboard de Stripe (M9) codifican esto en el Price mismo; este helper solo hace
// falta para Enterprise (M24), donde el monto se arma en runtime con price_data.
const ZERO_DECIMAL_CURRENCIES = new Set(["CLP"]);

export function toStripeUnitAmount(amount: number, currency: string): number {
  if (ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())) {
    return Math.round(amount);
  }
  return Math.round(amount * 100);
}
