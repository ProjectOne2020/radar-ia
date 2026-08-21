"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function RemeasureButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleClick() {
    setLoading(true);
    setError(null);
    setDone(false);

    const res = await fetch("/api/admin/remeasure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Error");
      return;
    }

    setDone(true);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="secondary" onClick={handleClick} disabled={loading}>
        {loading ? "Corriendo auditoría… (puede tardar varios minutos)" : "Correr auditoría completa ahora"}
      </Button>
      {error && <p className="text-xs text-critical">{error}</p>}
      {done && !error && <p className="text-xs text-good">Auditoría completada — datos actualizados abajo.</p>}
    </div>
  );
}
