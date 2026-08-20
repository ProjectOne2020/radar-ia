"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PLANS } from "@/lib/pricing/plans";
import { Panel, Alert } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PublicListingToggle } from "@/components/dashboard/public-listing-toggle";
import { cn } from "@/lib/cn";

// M9 — dispara los dos cargos SEPARADOS (setup fee -> suscripcion), nunca combinados.
export default function PlanPage() {
  const t = useTranslations("DashboardPlan");
  const tFeatures = useTranslations("Precios");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleChoose(planId: string) {
    setError(null);
    setLoadingPlan(planId);

    try {
      const setupRes = await fetch("/api/checkout/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const setupData = await setupRes.json();
      if (!setupRes.ok) throw new Error(setupData.error ?? t("setupError"));

      if (setupData.url) {
        // Hay que cobrar el setup primero en Stripe — la suscripcion se dispara despues,
        // desde /checkout/exito, para no combinar los dos cargos en un solo paso.
        window.location.assign(setupData.url);
        return;
      }

      // setup ya estaba en $0 (Lite self-serve) — seguir directo a la suscripcion.
      const subRes = await fetch("/api/checkout/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const subData = await subRes.json();
      if (!subRes.ok) throw new Error(subData.error ?? t("subscriptionError"));
      window.location.assign(subData.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoadingPlan(null);
    }
  }

  return (
    <>
      <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>

      <Alert tone="neutral" className="mt-4 max-w-[560px]">
        {t("doubleChargeNote")}
      </Alert>

      {error && (
        <Alert tone="critical" className="mt-4 max-w-[420px]">
          {error}
        </Alert>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.filter((p) => p.hasStripeCheckout).map((plan) => (
          <Panel
            key={plan.id}
            raised
            className={cn(plan.flagship && "border-signal ring-1 ring-signal")}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-ink">{plan.name}</h2>
              {plan.flagship && <Badge tone="signal">{t("flagshipLabel")}</Badge>}
            </div>
            <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-text-secondary">
              {tFeatures(plan.featuresKey)}
            </p>
            <Button
              onClick={() => handleChoose(plan.id)}
              disabled={loadingPlan !== null}
              variant={plan.flagship ? "primary" : "secondary"}
              className="mt-5 w-full"
            >
              {loadingPlan === plan.id ? t("redirectingToStripe") : t("choosePlan", { plan: plan.name })}
            </Button>
          </Panel>
        ))}
      </div>

      <PublicListingToggle />
    </>
  );
}
