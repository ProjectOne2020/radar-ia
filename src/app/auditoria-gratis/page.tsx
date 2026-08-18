"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { NICHES, SUPPORTED_COUNTRIES } from "@/lib/auth/country";

export default function AuditoriaGratisPage() {
  const t = useTranslations("AuditoriaGratis");
  const tNiches = useTranslations("Niches");
  const tCountries = useTranslations("Countries");
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
        setError(data.error ?? t("genericError"));
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
      <h1>{t("title")}</h1>
      <p>{t("hook")}</p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
        <label>
          {t("businessName")}
          <input
            required
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
          />
        </label>

        <label>
          {t("niche")}
          <select value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })}>
            {NICHES.map((n) => (
              <option key={n.value} value={n.value}>
                {tNiches(n.value)}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t("city")}
          <input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </label>

        <label>
          {t("country")}
          <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
            {SUPPORTED_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {tCountries(c.code)}
              </option>
            ))}
          </select>
        </label>

        {isApp && (
          <>
            <label>
              {t("iosAppId")}
              <input
                placeholder={t("iosAppIdPlaceholder")}
                value={form.iosAppId}
                onChange={(e) => setForm({ ...form, iosAppId: e.target.value })}
              />
            </label>
            <label>
              {t("androidPackageId")}
              <input
                placeholder={t("androidPackageIdPlaceholder")}
                value={form.androidPackageId}
                onChange={(e) => setForm({ ...form, androidPackageId: e.target.value })}
              />
            </label>
          </>
        )}

        <label>
          {isApp ? t("websiteUrlApp") : t("websiteUrl")}
          <input
            required={!isApp}
            type="url"
            placeholder={t("websiteUrlPlaceholder")}
            value={form.websiteUrl}
            onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
          />
        </label>

        <label>
          {t("whatsapp")}
          <input
            required
            placeholder={t("whatsappPlaceholder")}
            value={form.phoneWhatsapp}
            onChange={(e) => setForm({ ...form, phoneWhatsapp: e.target.value })}
          />
        </label>

        {error && <p style={{ color: "crimson" }}>{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? t("submitting") : t("submit")}
        </button>
      </form>
    </main>
  );
}
