import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { PLANS, getSetupFee, getRecurringFee, isManualCurrency } from "@/lib/pricing/plans";
import { SiteHeader } from "@/components/site-header";
import { Container } from "@/components/ui/container";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";

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
  const t = await getTranslations("Precios");
  const tPlan = await getTranslations("DashboardPlan");
  const headerList = await headers();
  const detectedCurrency = headerList.get("x-radar-currency") ?? "USD";
  const currency = isManualCurrency(detectedCurrency) ? detectedCurrency : "USD";

  return (
    <>
      <SiteHeader />
      <main>
        <Container className="py-10 sm:py-16">
          <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>
          <p className="mt-2 text-text-secondary">{t("shownIn", { currency })}</p>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => {
              const recurring = isManualCurrency(currency) ? getRecurringFee(plan.id, currency) : null;
              const setup = isManualCurrency(currency) ? getSetupFee(plan.id, currency, "self_serve") : null;

              return (
                <Panel
                  key={plan.id}
                  raised
                  className={cn("flex flex-col", plan.flagship && "border-signal ring-1 ring-signal")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold text-ink">{plan.name}</h2>
                    {plan.flagship && <Badge tone="signal">{tPlan("flagshipLabel")}</Badge>}
                  </div>

                  <div className="mt-4 flex-1">
                    {!plan.hasStripeCheckout ? (
                      <p className="text-text-secondary">{t("customQuote")}</p>
                    ) : recurring !== null ? (
                      <>
                        <p className="font-mono text-2xl font-semibold text-ink">
                          {formatMoney(recurring, currency)}
                          <span className="text-sm font-normal text-text-muted">{t("perMonth")}</span>
                        </p>
                        <p className="mt-1.5 text-sm text-text-secondary">
                          {t("setupLabel", {
                            amount:
                              setup === 0
                                ? t("setupFree")
                                : setup !== null
                                  ? formatMoney(setup, currency)
                                  : t("setupUnknown"),
                          })}
                        </p>
                      </>
                    ) : (
                      <p className="text-text-secondary">{t("priceAtCheckout")}</p>
                    )}

                    <p className="mt-4 border-t border-border pt-4 text-sm leading-relaxed text-text-secondary">
                      {t(plan.featuresKey)}
                    </p>
                  </div>

                  {plan.hasStripeCheckout ? (
                    <ButtonLink
                      href="/registro"
                      variant={plan.flagship ? "primary" : "secondary"}
                      className="mt-5 w-full"
                    >
                      {t("choosePlan", { plan: plan.name })}
                    </ButtonLink>
                  ) : (
                    <Button variant="secondary" className="mt-5 w-full">
                      {t("contactQuote")}
                    </Button>
                  )}
                </Panel>
              );
            })}
          </div>

          <Panel raised className="mt-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold text-ink">{t("agencyTitle")}</h2>
              <p className="mt-1.5 max-w-[56ch] text-sm text-text-secondary">{t("agencyBody")}</p>
            </div>
            <Button variant="secondary" className="shrink-0">
              {t("agencyCta")}
            </Button>
          </Panel>
        </Container>
      </main>
    </>
  );
}
