import { headers } from "next/headers";
import { PLANS, getSetupFee, getRecurringFee, isManualCurrency } from "@/lib/pricing/plans";

const CURRENCY_LOCALE: Record<string, string> = {
  MXN: "es-MX",
  COP: "es-CO",
  CLP: "es-CL",
  PEN: "es-PE",
  ARS: "es-AR",
  BRL: "pt-BR",
  USD: "en-US",
};

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency] ?? "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

// M8 — el middleware ya resolvio pais->moneda y lo dejo en el header x-radar-currency.
// Si el pais no tiene moneda manual configurada, cae a USD y Adaptive Pricing de Stripe
// resuelve la conversion real en el Checkout (M9) — aqui solo se muestra el precio.
export default async function PreciosPage() {
  const headerList = await headers();
  const detectedCurrency = headerList.get("x-radar-currency") ?? "USD";
  const currency = isManualCurrency(detectedCurrency) ? detectedCurrency : "USD";

  return (
    <main style={{ padding: 60, maxWidth: 900, fontFamily: "sans-serif" }}>
      <h1>Precios</h1>
      <p style={{ color: "#666" }}>Precios mostrados en {currency}.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 24 }}>
        {PLANS.map((plan) => {
          const recurring = isManualCurrency(currency) ? getRecurringFee(plan.id, currency) : null;
          const setup = isManualCurrency(currency) ? getSetupFee(plan.id, currency, "self_serve") : null;

          return (
            <div
              key={plan.id}
              style={{
                border: plan.flagship ? "2px solid #3c78d8" : "1px solid #ddd",
                borderRadius: 8,
                padding: 16,
              }}
            >
              <h2>
                {plan.name} {plan.flagship && "⭐"}
              </h2>

              {!plan.hasStripeCheckout ? (
                <>
                  <p>Cotización custom</p>
                  <button>Contactar para cotización</button>
                </>
              ) : recurring !== null ? (
                <>
                  <p style={{ fontSize: 24, fontWeight: 600 }}>
                    {formatMoney(recurring, currency)}
                    <span style={{ fontSize: 14, fontWeight: 400 }}>/mes</span>
                  </p>
                  <p style={{ color: "#666" }}>
                    Setup: {setup === 0 ? "$0 (autoguiado)" : setup !== null ? formatMoney(setup, currency) : "—"}
                  </p>
                  <button>Elegir {plan.name}</button>
                </>
              ) : (
                <p>Precio disponible en checkout (USD, conversión automática).</p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
