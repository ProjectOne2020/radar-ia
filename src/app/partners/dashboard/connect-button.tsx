"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function ConnectButton({ label }: { label: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/partners/connect/onboard", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setError(data.error ?? "Error");
      return;
    }
    window.location.href = data.url;
  }

  return (
    <div>
      <Button size="sm" onClick={handleClick} disabled={loading}>
        {loading ? "Redirigiendo..." : label}
      </Button>
      {error && <p className="mt-2 text-sm text-critical">{error}</p>}
    </div>
  );
}
