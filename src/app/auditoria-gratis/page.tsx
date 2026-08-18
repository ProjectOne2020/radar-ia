"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NICHES, SUPPORTED_COUNTRIES } from "@/lib/auth/country";

export default function AuditoriaGratisPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    businessName: "",
    niche: "dental",
    city: "",
    country: "MX",
    websiteUrl: "",
    phoneWhatsapp: "",
    iosAppId: "",
    androidPackageId: "",
  });
  const isApp = form.niche === "app";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/free-audit/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "No se pudo procesar la auditoría.");
        setLoading(false);
        return;
      }

      router.push(`/auditoria-gratis/verificar?freeAuditId=${data.freeAuditId}&clientId=${data.clientId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 60, maxWidth: 480, fontFamily: "sans-serif" }}>
      <h1>Auditoría gratis de visibilidad en IA</h1>
      <p>
        ¿Sabes si ChatGPT, Claude o Gemini recomiendan tu negocio cuando alguien pregunta en tu
        ciudad? Te lo mostramos en un par de minutos.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
        <label>
          Nombre del negocio
          <input
            required
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
          />
        </label>

        <label>
          Rubro
          <select value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })}>
            {NICHES.map((n) => (
              <option key={n.value} value={n.value}>
                {n.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Ciudad
          <input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </label>

        <label>
          País
          <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
            {SUPPORTED_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        {isApp && (
          <>
            <label>
              ID de App Store (Apple)
              <input
                placeholder="ej. 123456789"
                value={form.iosAppId}
                onChange={(e) => setForm({ ...form, iosAppId: e.target.value })}
              />
            </label>
            <label>
              Package de Google Play
              <input
                placeholder="ej. com.tuempresa.tuapp"
                value={form.androidPackageId}
                onChange={(e) => setForm({ ...form, androidPackageId: e.target.value })}
              />
            </label>
          </>
        )}

        <label>
          {isApp ? "Sitio web de la app (opcional)" : "Sitio web"}
          <input
            required={!isApp}
            type="url"
            placeholder="https://tunegocio.com"
            value={form.websiteUrl}
            onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
          />
        </label>

        <label>
          WhatsApp (formato +52...)
          <input
            required
            placeholder="+528100000000"
            value={form.phoneWhatsapp}
            onChange={(e) => setForm({ ...form, phoneWhatsapp: e.target.value })}
          />
        </label>

        {error && <p style={{ color: "crimson" }}>{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Auditando tu negocio... (puede tardar un momento)" : "Auditar mi negocio gratis"}
        </button>
      </form>
    </main>
  );
}
