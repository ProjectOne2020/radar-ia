"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";
import { Panel, Alert } from "@/components/ui/panel";
import { ButtonLink } from "@/components/ui/button";
import { IntakeForm } from "./intake-form";

function ExitoContent() {
  const t = useTranslations("CheckoutExito");
  const searchParams = useSearchParams();
  const type = searchParams.get("type");
  const plan = searchParams.get("plan");
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(type === "setup");
  const [intakeDone, setIntakeDone] = useState(false);

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

  if (error) {
    return (
      <Container narrow className="py-16">
        <Alert tone="critical">{error}</Alert>
      </Container>
    );
  }

  if (redirecting) {
    return (
      <Container narrow className="py-16">
        <p className="text-text-secondary">{t("redirecting")}</p>
      </Container>
    );
  }

  // El formulario de "que necesitamos para implementar" se muestra AQUI, justo despues de
  // confirmar el pago (setup + suscripcion), no antes de pagar — pedido explicito del
  // fundador para no meter friccion extra en la decision de compra.
  if (type === "subscription" && !intakeDone) {
    return (
      <Container narrow className="py-16">
        <Alert tone="good" className="mb-6">
          {t("body")}
        </Alert>
        <IntakeForm onDone={() => setIntakeDone(true)} />
      </Container>
    );
  }

  return (
    <Container narrow className="py-16">
      <Panel raised>
        <h1 className="text-2xl">{t("title")}</h1>
        <p className="mt-2 text-text-secondary">{t("body")}</p>
        <ButtonLink href="/dashboard" className="mt-5 inline-flex">
          {t("goToDashboard")}
        </ButtonLink>
      </Panel>
    </Container>
  );
}

export default function ExitoPage() {
  return (
    <main>
      <Suspense>
        <ExitoContent />
      </Suspense>
    </main>
  );
}
