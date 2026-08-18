"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewPartnerForm() {
  const router = useRouter();
  const [agencyName, setAgencyName] = useState("");
  const [revenueSharePct, setRevenueSharePct] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<{ apiKey: string; agencyName: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agencyName,
        revenueSharePct: revenueSharePct.trim() === "" ? null : Number(revenueSharePct),
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Error");
      return;
    }

    setCreatedKey({ apiKey: data.apiKey, agencyName: data.partner.agency_name });
    setAgencyName("");
    setRevenueSharePct("");
    router.refresh();
  }

  if (createdKey) {
    return (
      <div style={{ border: "2px solid #333", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <p>
          Partner <strong>{createdKey.agencyName}</strong> creado. Esta es la ÚNICA vez que se muestra la API key
          — cópiala ahora, no se puede recuperar después:
        </p>
        <code style={{ display: "block", padding: 8, background: "#f0f0f0", wordBreak: "break-all" }}>
          {createdKey.apiKey}
        </code>
        <button onClick={() => setCreatedKey(null)} style={{ marginTop: 8 }}>
          Entendido
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "end", marginBottom: 16 }}>
      <label>
        Agencia
        <br />
        <input value={agencyName} onChange={(e) => setAgencyName(e.target.value)} required minLength={2} />
      </label>
      <label>
        % revenue share
        <br />
        <input
          type="number"
          min={0}
          max={100}
          step="0.1"
          value={revenueSharePct}
          onChange={(e) => setRevenueSharePct(e.target.value)}
          placeholder="opcional"
        />
      </label>
      <button type="submit" disabled={loading}>
        {loading ? "Creando..." : "Crear partner"}
      </button>
      {error && <span style={{ color: "red" }}>{error}</span>}
    </form>
  );
}
