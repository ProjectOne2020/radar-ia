"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Competitor {
  linkId: string;
  competitorClientId: string | null;
  businessName: string;
  scoreTotal: number | null;
  calculatedAt: string | null;
}

export default function CompetidoresPage() {
  const [competitors, setCompetitors] = useState<Competitor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ competitorName: "", city: "", websiteUrl: "" });
  const [adding, setAdding] = useState(false);

  async function loadCompetitors() {
    const res = await fetch("/api/dashboard/competitors");
    const data = await res.json();
    if (res.ok) setCompetitors(data.competitors);
  }

  useEffect(() => {
    let ignore = false;
    fetch("/api/dashboard/competitors")
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ignore && ok) setCompetitors(data.competitors);
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);

    const res = await fetch("/api/dashboard/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setAdding(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo agregar el competidor.");
      return;
    }

    setForm({ competitorName: "", city: "", websiteUrl: "" });
    await loadCompetitors();
  }

  return (
    <main style={{ padding: 60, maxWidth: 640, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/dashboard">← Volver</Link>
      </p>
      <h1>Competidores</h1>
      <p>Se comparan usando las mismas preguntas activas de tu negocio, mismo día.</p>

      <ul>
        {(competitors ?? []).map((c) => (
          <li key={c.linkId}>
            {c.businessName}: {c.scoreTotal !== null ? `${Math.round(c.scoreTotal)}/100` : "score pendiente"}
          </li>
        ))}
      </ul>
      {competitors && competitors.length === 0 && <p>Todavía no has agregado competidores.</p>}

      <h2>Agregar competidor</h2>
      <p style={{ color: "#666" }}>
        Correr esto llama a los motores de IA reales — puede tardar 30-60 segundos.
      </p>
      <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 380 }}>
        <label>
          Nombre del competidor
          <input
            required
            value={form.competitorName}
            onChange={(e) => setForm({ ...form, competitorName: e.target.value })}
          />
        </label>
        <label>
          Ciudad
          <input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </label>
        <label>
          Sitio web
          <input
            required
            type="url"
            value={form.websiteUrl}
            onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
          />
        </label>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={adding}>
          {adding ? "Auditando competidor..." : "Agregar y comparar"}
        </button>
      </form>
    </main>
  );
}
