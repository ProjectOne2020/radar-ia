"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function FlaggedActions({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function handle(action: "approve" | "reject") {
    setLoading(action);
    const res = await fetch("/api/admin/flagged", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, action }),
    });
    const data = await res.json();
    setLoading(null);

    if (!res.ok) {
      setResult(data.error ?? "Error");
      return;
    }

    setResult(action === "approve" ? "Aprobado — verificado." : "Rechazado — permanece marcado.");
    if (action === "approve") router.refresh();
  }

  if (result) return <p className="mt-2 text-sm text-text-secondary">{result}</p>;

  return (
    <div className="mt-3 flex gap-2">
      <Button size="sm" onClick={() => handle("approve")} disabled={loading !== null}>
        {loading === "approve" ? "..." : "Aprobar"}
      </Button>
      <Button size="sm" variant="secondary" onClick={() => handle("reject")} disabled={loading !== null}>
        {loading === "reject" ? "..." : "Rechazar"}
      </Button>
    </div>
  );
}
