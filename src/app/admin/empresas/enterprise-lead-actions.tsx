"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MANUAL_CURRENCIES } from "@/lib/pricing/plans";

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
    return <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>Rechazada.</p>;
  }

  if (status === "approved") {
    return (
      <div style={{ marginTop: 8 }}>
        <p style={{ fontSize: 13 }}>Aprobada y cobro generado.</p>
        {lastCheckoutUrl && (
          <p style={{ fontSize: 13, wordBreak: "break-all" }}>
            Link de pago: <a href={lastCheckoutUrl} target="_blank" rel="noreferrer">{lastCheckoutUrl}</a>
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 13 }}>
          Moneda{" "}
          <select
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            style={{ padding: 4 }}
          >
            {MANUAL_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 13 }}>
          Setup (único pago){" "}
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.setupFee}
            onChange={(e) => setForm({ ...form, setupFee: e.target.value })}
            placeholder="0"
            style={{ width: 100 }}
          />
        </label>
        <label style={{ fontSize: 13 }}>
          Mensual{" "}
          <input
            type="number"
            min={0.01}
            step="0.01"
            value={form.recurringFee}
            onChange={(e) => setForm({ ...form, recurringFee: e.target.value })}
            placeholder="0"
            style={{ width: 100 }}
          />
        </label>
        <button
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
        </button>
        {status === "quoted" && (
          <button onClick={() => call("charge")} disabled={loading !== null}>
            {loading === "charge" ? "..." : "Aprobar y generar cobro"}
          </button>
        )}
        <button onClick={() => call("reject")} disabled={loading !== null}>
          {loading === "reject" ? "..." : "Rechazar"}
        </button>
      </div>
      {error && <p style={{ color: "red", fontSize: 13, marginTop: 4 }}>{error}</p>}
    </div>
  );
}
