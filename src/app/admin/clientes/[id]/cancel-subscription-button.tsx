"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function CancelSubscriptionButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/cancel-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    setConfirming(false);

    if (!res.ok) {
      setError(data.error ?? "Error");
      return;
    }

    setDone(true);
    router.refresh();
  }

  if (done) {
    return <p className="text-xs text-good">Cancelación programada — se corta al vencer el período actual.</p>;
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <p className="text-xs text-text-secondary">
          Se cancelará al terminar el período ya pagado (no de inmediato). ¿Confirmar?
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setConfirming(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="border-critical text-critical hover:border-critical hover:bg-critical-soft"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Procesando…" : "Sí, cancelar suscripción"}
          </Button>
        </div>
        {error && <p className="text-xs text-critical">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
        Cancelar suscripción
      </Button>
      {error && <p className="text-xs text-critical">{error}</p>}
    </div>
  );
}
