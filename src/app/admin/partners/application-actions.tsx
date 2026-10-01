"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/panel";
import { QUESTION_BANK_COUNTRIES } from "@/lib/question-bank/taxonomy";

export default function ApplicationActions({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [revenueSharePct, setRevenueSharePct] = useState("");
  const [country, setCountry] = useState("MX");
  const [loading, setLoading] = useState<"accept" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);

  async function handle(action: "accept" | "reject") {
    setLoading(action);
    setError(null);

    const res = await fetch("/api/admin/partner-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId,
        action,
        country: action === "accept" ? country : undefined,
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
      setInviteSent(Boolean(data.inviteEmailSent));
    } else {
      router.refresh();
    }
  }

  if (createdKey) {
    return (
      <Alert tone="warning" className="mt-3">
        <p>Partner creado y solicitud aceptada. Esta es la ÚNICA vez que se muestra la API key — cópiala ahora:</p>
        <code className="mt-2 block rounded-xs bg-surface-sunken p-2 font-mono text-xs break-all">{createdKey}</code>
        <p className="mt-2 text-sm text-text-secondary">
          {inviteSent
            ? "Le enviamos un correo para que active su panel de agencia."
            : "No se pudo enviar el correo de invitación al panel (revisa que Resend esté configurado) — avísale tú por otro medio."}
        </p>
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => router.refresh()}>
          Entendido
        </Button>
      </Alert>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <label className="text-sm text-text-secondary">
        País{" "}
        <Select value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1">
          {QUESTION_BANK_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </Select>
      </label>
      <label className="text-sm text-text-secondary">
        % revenue share{" "}
        <Input
          type="number"
          min={0}
          max={100}
          step="0.1"
          value={revenueSharePct}
          onChange={(e) => setRevenueSharePct(e.target.value)}
          placeholder="opcional"
          className="mt-1 w-24"
        />
      </label>
      <Button size="sm" onClick={() => handle("accept")} disabled={loading !== null}>
        {loading === "accept" ? "..." : "Aceptar"}
      </Button>
      <Button size="sm" variant="secondary" onClick={() => handle("reject")} disabled={loading !== null}>
        {loading === "reject" ? "..." : "Rechazar"}
      </Button>
      {error && <span className="text-sm text-critical">{error}</span>}
    </div>
  );
}
