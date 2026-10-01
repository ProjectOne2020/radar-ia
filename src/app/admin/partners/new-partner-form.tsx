"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/panel";
import { QUESTION_BANK_COUNTRIES } from "@/lib/question-bank/taxonomy";

export default function NewPartnerForm() {
  const router = useRouter();
  const [agencyName, setAgencyName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("MX");
  const [revenueSharePct, setRevenueSharePct] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<{ apiKey: string; agencyName: string; inviteSent: boolean } | null>(
    null,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agencyName,
        email,
        country,
        revenueSharePct: revenueSharePct.trim() === "" ? null : Number(revenueSharePct),
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Error");
      return;
    }

    setCreatedKey({ apiKey: data.apiKey, agencyName: data.partner.agency_name, inviteSent: Boolean(data.inviteEmailSent) });
    setAgencyName("");
    setEmail("");
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
        <p className="mt-2 text-sm text-text-secondary">
          {createdKey.inviteSent
            ? "Le enviamos un correo para que active su panel de agencia."
            : "No se pudo enviar el correo de invitación al panel — avísale tú por otro medio."}
        </p>
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
        <Label htmlFor="partnerEmail">Correo</Label>
        <Input
          id="partnerEmail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-56"
        />
      </div>
      <div>
        <Label htmlFor="partnerCountry">País</Label>
        <Select id="partnerCountry" value={country} onChange={(e) => setCountry(e.target.value)} className="w-40">
          {QUESTION_BANK_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </Select>
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
