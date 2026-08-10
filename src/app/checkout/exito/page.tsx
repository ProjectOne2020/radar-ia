"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function ExitoContent() {
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
        if (!res.ok) throw new Error(data.error ?? "No se pudo iniciar la suscripción.");
        window.location.assign(data.url);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setRedirecting(false);
      });
  }, [type, plan]);

  if (error) return <p style={{ color: "crimson", padding: 60 }}>{error}</p>;
  if (redirecting) return <p style={{ padding: 60 }}>Setup pagado — redirigiendo a la suscripción...</p>;

  return (
    <main style={{ padding: 60, fontFamily: "sans-serif" }}>
      <h1>¡Listo!</h1>
      <p>Tu suscripción quedó activa.</p>
      <a href="/dashboard">Ir al dashboard</a>
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
