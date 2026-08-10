"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NICHES, SUPPORTED_COUNTRIES } from "@/lib/auth/country";

export default function RegistroPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    businessName: "",
    niche: "dental",
    country: "MX",
    phoneWhatsapp: "",
    taxId: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "No se pudo registrar.");
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (signInError) {
        setError(`Cuenta creada pero no se pudo iniciar sesión: ${signInError.message}`);
        setLoading(false);
        return;
      }

      router.push("/verificar");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 60, maxWidth: 480, fontFamily: "sans-serif" }}>
      <h1>Crea tu cuenta en Radar IA</h1>
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
          País
          <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
            {SUPPORTED_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
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

        <label>
          RFC / NIT / RUT / RUC / CUIT
          <input required value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
        </label>

        <label>
          Correo
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>

        <label>
          Contraseña
          <input
            required
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>

        {error && <p style={{ color: "crimson" }}>{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>
      </form>
    </main>
  );
}
