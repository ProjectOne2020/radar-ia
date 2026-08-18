"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

  if (result) return <p>{result}</p>;

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <button onClick={() => handle("approve")} disabled={loading !== null}>
        {loading === "approve" ? "..." : "Aprobar"}
      </button>
      <button onClick={() => handle("reject")} disabled={loading !== null}>
        {loading === "reject" ? "..." : "Rechazar"}
      </button>
    </div>
  );
}
