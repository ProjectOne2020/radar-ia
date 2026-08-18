"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ApplicationActions({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [revenueSharePct, setRevenueSharePct] = useState("");
  const [loading, setLoading] = useState<"accept" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  async function handle(action: "accept" | "reject") {
    setLoading(action);
    setError(null);

    const res = await fetch("/api/admin/partner-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId,
        action,
        revenueSharePct: revenueSharePct.trim() === "" ? null : Number(revenueSharePct),
      }),
    });
    const data = await res.json();
    setLoading(null);

    if (!res.ok) {
      setError(data.error ?? "Error");
      return;
    }

    if (action === "accept") {
      setCreatedKey(data.apiKey);
    } else {
      router.refresh();
    }
  }

  if (createdKey) {
    return (
      <div style={{ border: "2px solid #333", borderRadius: 8, padding: 12, marginTop: 8 }}>
        <p>
          Partner creado y solicitud aceptada. Esta es la ÚNICA vez que se muestra la API key — cópiala ahora:
        </p>
        <code style={{ display: "block", padding: 8, background: "#f0f0f0", wordBreak: "break-all" }}>
          {createdKey}
        </code>
        <button onClick={() => router.refresh()} style={{ marginTop: 8 }}>
          Entendido
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
      <label style={{ fontSize: 13 }}>
        % revenue share{" "}
        <input
          type="number"
          min={0}
          max={100}
          step="0.1"
          value={revenueSharePct}
          onChange={(e) => setRevenueSharePct(e.target.value)}
          placeholder="opcional"
          style={{ width: 80 }}
        />
      </label>
      <button onClick={() => handle("accept")} disabled={loading !== null}>
        {loading === "accept" ? "..." : "Aceptar"}
      </button>
      <button onClick={() => handle("reject")} disabled={loading !== null}>
        {loading === "reject" ? "..." : "Rechazar"}
      </button>
      {error && <span style={{ color: "red", fontSize: 13 }}>{error}</span>}
    </div>
  );
}
