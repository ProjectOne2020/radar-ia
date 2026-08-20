"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { Alert } from "@/components/ui/panel";

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
      <Alert tone="warning" className="mb-5">
        <p>
          Partner <strong>{createdKey.agencyName}</strong> creado. Esta es la ÚNICA vez que se muestra la API key —
          cópiala ahora, no se puede recuperar después:
        </p>
        <code className="mt-2 block rounded-xs bg-surface-sunken p-2 font-mono text-xs break-all">
          {createdKey.apiKey}
        </code>
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => setCreatedKey(null)}>
          Entendido
        </Button>
      </Alert>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-5 flex flex-wrap items-end gap-4 rounded-md border border-border bg-surface p-5 sm:p-6"
    >
      <div>
        <Label htmlFor="agencyName">Agencia</Label>
        <Input
          id="agencyName"
          value={agencyName}
          onChange={(e) => setAgencyName(e.target.value)}
          required
          minLength={2}
          className="w-56"
        />
      </div>
      <div>
        <Label htmlFor="revenueShare">% revenue share</Label>
        <Input
          id="revenueShare"
          type="number"
          min={0}
          max={100}
          step="0.1"
          value={revenueSharePct}
          onChange={(e) => setRevenueSharePct(e.target.value)}
          placeholder="opcional"
          className="w-32"
        />
      </div>
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? "Creando..." : "Crear partner"}
      </Button>
      {error && <span className="text-sm text-critical">{error}</span>}
    </form>
  );
}
