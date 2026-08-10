"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VerificarPage() {
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

    const res = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Código inválido.");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main style={{ padding: 60, maxWidth: 420, fontFamily: "sans-serif" }}>
      <h1>Verifica tu negocio</h1>
      <p>Te vamos a enviar un código de 6 dígitos por WhatsApp al número que registraste.</p>

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
            {loading ? "Verificando..." : "Verificar"}
          </button>
          <button type="button" onClick={handleSend} disabled={loading}>
            Reenviar código
          </button>
        </form>
      )}
    </main>
  );
}
