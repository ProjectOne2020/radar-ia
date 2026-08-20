"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MANUAL_CURRENCIES } from "@/lib/pricing/plans";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";

interface Props {
  leadId: string;
  status: string;
  currency: string | null;
  quotedSetupFee: number | null;
  quotedRecurringFee: number | null;
  checkoutUrl: string | null;
}

export default function EnterpriseLeadActions({ leadId, status, currency, quotedSetupFee, quotedRecurringFee, checkoutUrl }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    currency: currency ?? "MXN",
    setupFee: quotedSetupFee !== null ? String(quotedSetupFee) : "",
    recurringFee: quotedRecurringFee !== null ? String(quotedRecurringFee) : "",
  });
  const [loading, setLoading] = useState<"quote" | "reject" | "charge" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckoutUrl, setLastCheckoutUrl] = useState<string | null>(checkoutUrl);

  async function call(action: "quote" | "reject" | "charge", extra?: Record<string, unknown>) {
    setLoading(action);
    setError(null);

    const res = await fetch("/api/admin/enterprise-leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, action, ...extra }),
    });
    const data = await res.json();
    setLoading(null);

    if (!res.ok) {
      setError(data.error ?? "Error");
      return;
    }

    if (action === "charge") {
      setLastCheckoutUrl(data.checkoutUrl);
    }
    router.refresh();
  }

  if (status === "rejected") {
    return <p className="mt-2 text-sm text-text-muted">Rechazada.</p>;
  }

  if (status === "approved") {
    return (
      <div className="mt-2">
        <p className="text-sm text-text-secondary">Aprobada y cobro generado.</p>
        {lastCheckoutUrl && (
          <p className="mt-1 text-sm break-all">
            Link de pago:{" "}
            <a href={lastCheckoutUrl} target="_blank" rel="noreferrer" className="text-signal-strong hover:underline">
              {lastCheckoutUrl}
            </a>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor={`currency-${leadId}`}>Moneda</Label>
          <Select
            id={`currency-${leadId}`}
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            className="w-28"
          >
            {MANUAL_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`setup-${leadId}`}>Setup (único pago)</Label>
          <Input
            id={`setup-${leadId}`}
            type="number"
            min={0}
            step="0.01"
            value={form.setupFee}
            onChange={(e) => setForm({ ...form, setupFee: e.target.value })}
            placeholder="0"
            className="w-28"
          />
        </div>
        <div>
          <Label htmlFor={`recurring-${leadId}`}>Mensual</Label>
          <Input
            id={`recurring-${leadId}`}
            type="number"
            min={0.01}
            step="0.01"
            value={form.recurringFee}
            onChange={(e) => setForm({ ...form, recurringFee: e.target.value })}
            placeholder="0"
            className="w-28"
          />
        </div>
        <Button
          size="sm"
          onClick={() =>
            call("quote", {
              currency: form.currency,
              setupFee: form.setupFee === "" ? 0 : Number(form.setupFee),
              recurringFee: Number(form.recurringFee),
            })
          }
          disabled={loading !== null || form.recurringFee === ""}
        >
          {loading === "quote" ? "..." : "Cotizar"}
        </Button>
        {status === "quoted" && (
          <Button size="sm" variant="signal" onClick={() => call("charge")} disabled={loading !== null}>
            {loading === "charge" ? "..." : "Aprobar y generar cobro"}
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => call("reject")} disabled={loading !== null}>
          {loading === "reject" ? "..." : "Rechazar"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-critical">{error}</p>}
    </div>
  );
}
