"use client";

import { useState } from "react";
import Link from "next/link";
import { PLANS } from "@/lib/pricing/plans";

// M9 — dispara los dos cargos SEPARADOS (setup fee -> suscripcion), nunca combinados.
export default function PlanPage() {
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
      if (!setupRes.ok) throw new Error(setupData.error ?? "No se pudo iniciar el cobro de setup.");

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
      if (!subRes.ok) throw new Error(subData.error ?? "No se pudo iniciar la suscripción.");
      window.location.assign(subData.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoadingPlan(null);
    }
  }

  return (
    <main style={{ padding: 60, maxWidth: 720, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/dashboard">← Volver</Link>
      </p>
      <h1>Elige tu plan</h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
        {PLANS.filter((p) => p.hasStripeCheckout).map((plan) => (
          <div key={plan.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
            <h2>
              {plan.name} {plan.flagship && "⭐"}
            </h2>
            <button onClick={() => handleChoose(plan.id)} disabled={loadingPlan !== null}>
              {loadingPlan === plan.id ? "Redirigiendo a Stripe..." : `Elegir ${plan.name}`}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
