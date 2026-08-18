"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function VerificarPage() {
  const t = useTranslations("Verificar");
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/otp/send", { method: "POST" });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? t("sendError"));
      return;
    }

    setSent(true);
    setInfo(data.whatsappConfigured ? t("whatsappSent") : t("whatsappNotConfigured"));
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? t("invalidCode"));
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main style={{ padding: 60, maxWidth: 420, fontFamily: "sans-serif" }}>
      <h1>{t("title")}</h1>
      <p>{t("subtitle")}</p>

      {!sent && (
        <button onClick={handleSend} disabled={loading}>
          {loading ? t("sending") : t("sendCode")}
        </button>
      )}

      {info && <p>{info}</p>}

      {sent && (
        <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
          <label>
            {t("code")}
            <input required value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
          </label>
          {error && <p style={{ color: "crimson" }}>{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? t("verifying") : t("verify")}
          </button>
          <button type="button" onClick={handleSend} disabled={loading}>
            {t("resend")}
          </button>
        </form>
      )}
    </main>
  );
}
