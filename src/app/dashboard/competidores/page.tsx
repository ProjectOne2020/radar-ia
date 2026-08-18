"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface Competitor {
  linkId: string;
  competitorClientId: string | null;
  businessName: string;
  scoreTotal: number | null;
  calculatedAt: string | null;
}

export default function CompetidoresPage() {
  const t = useTranslations("DashboardCompetidores");
  const tCommon = useTranslations("Common");
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
      setError(data.error ?? t("genericError"));
      return;
    }

    setForm({ competitorName: "", city: "", websiteUrl: "" });
    await loadCompetitors();
  }

  return (
    <main style={{ padding: 60, maxWidth: 640, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/dashboard">{tCommon("back")}</Link>
      </p>
      <h1>{t("title")}</h1>
      <p>{t("subtitle")}</p>

      <ul>
        {(competitors ?? []).map((c) => (
          <li key={c.linkId}>
            {c.businessName}: {c.scoreTotal !== null ? `${Math.round(c.scoreTotal)}/100` : t("scorePending")}
          </li>
        ))}
      </ul>
      {competitors && competitors.length === 0 && <p>{t("empty")}</p>}

      <h2>{t("addTitle")}</h2>
      <p style={{ color: "#666" }}>{t("addNote")}</p>
      <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 380 }}>
        <label>
          {t("competitorName")}
          <input
            required
            value={form.competitorName}
            onChange={(e) => setForm({ ...form, competitorName: e.target.value })}
          />
        </label>
        <label>
          {t("city")}
          <input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </label>
        <label>
          {t("websiteUrl")}
          <input
            required
            type="url"
            value={form.websiteUrl}
            onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
          />
        </label>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={adding}>
          {adding ? t("auditing") : t("addAndCompare")}
        </button>
      </form>
    </main>
  );
}
