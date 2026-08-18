"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

function ExitoContent() {
  const t = useTranslations("CheckoutExito");
  const searchParams = useSearchParams();
  const type = searchParams.get("type");
  const plan = searchParams.get("plan");
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(type === "setup");

  useEffect(() => {
    if (type !== "setup" || !plan) return;

    // El setup fee ya se cobro (o era $0) -> encadena la suscripcion, cargo SEPARADO.
    fetch("/api/checkout/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? t("subscriptionError"));
        window.location.assign(data.url);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setRedirecting(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, plan]);

  if (error) return <p style={{ color: "crimson", padding: 60 }}>{error}</p>;
  if (redirecting) return <p style={{ padding: 60 }}>{t("redirecting")}</p>;

  return (
    <main style={{ padding: 60, fontFamily: "sans-serif" }}>
      <h1>{t("title")}</h1>
      <p>{t("body")}</p>
      <a href="/dashboard">{t("goToDashboard")}</a>
    </main>
  );
}

export default function ExitoPage() {
  return (
    <Suspense>
      <ExitoContent />
    </Suspense>
  );
}
