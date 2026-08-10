"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function VerificarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const freeAuditId = searchParams.get("freeAuditId");
  const clientId = searchParams.get("clientId");

  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    setError(null);
    setLoading(true);
    const res = await fetch("/api/free-audit/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ freeAuditId }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo enviar el código.");
      return;
    }

    setSent(true);
    setInfo(
      data.whatsappConfigured
        ? "Te enviamos un código por WhatsApp."
        : "WhatsApp no está configurado en este entorno todavía — revisa los logs del servidor para ver el código (solo en desarrollo)."
    );
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/free-audit/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ freeAuditId, code }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Código inválido.");
      return;
    }

    router.push(`/auditoria-gratis/reporte?freeAuditId=${freeAuditId}&clientId=${clientId}`);
  }

  if (!freeAuditId || !clientId) {
    return <p>Falta información de la solicitud — vuelve a intentar la auditoría gratis.</p>;
  }

  return (
    <main style={{ padding: 60, maxWidth: 420, fontFamily: "sans-serif" }}>
      <h1>Ya tenemos tu auditoría lista</h1>
      <p>Verifica tu WhatsApp para ver el reporte.</p>

      {!sent && (
        <button onClick={handleSend} disabled={loading}>
          {loading ? "Enviando..." : "Enviar código"}
        </button>
      )}

      {info && <p>{info}</p>}

      {sent && (
        <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
          <label>
            Código
            <input required value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
          </label>
          {error && <p style={{ color: "crimson" }}>{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? "Verificando..." : "Ver mi reporte"}
          </button>
        </form>
      )}
    </main>
  );
}

export default function VerificarFreeAuditPage() {
  return (
    <Suspense>
      <VerificarContent />
    </Suspense>
  );
}
