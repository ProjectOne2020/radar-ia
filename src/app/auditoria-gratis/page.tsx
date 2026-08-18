"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { NICHES, SUPPORTED_COUNTRIES } from "@/lib/auth/country";
import { SiteHeader } from "@/components/site-header";
import { Container } from "@/components/ui/container";
import { Panel, Alert } from "@/components/ui/panel";
import { Input, Select, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { ScanningIndicator } from "@/components/radar/scanning-indicator";

const TOTAL_STEPS = 4;

// Auditoria gratis reestructurada en 4 pasos cortos (negocio -> ubicacion -> donde te
// buscamos -> contacto) en vez de un formulario plano de 6-8 campos, siguiendo la
// arquitectura de onboarding progresivo mobile-first documentada en
// 03-ARQUITECTURA-TECNICA.md. La validacion por paso preserva exactamente los mismos
// campos requeridos que el formulario plano original (regla de no romper funcionalidad).
export default function AuditoriaGratisPage() {
  const t = useTranslations("AuditoriaGratis");
  const tNiches = useTranslations("Niches");
  const tCountries = useTranslations("Countries");
  const router = useRouter();
  const [step, setStep] = useState(0);
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

  const stepValid = [
    form.businessName.trim().length > 0,
    form.city.trim().length > 0 && form.country.trim().length > 0,
    isApp || form.websiteUrl.trim().length > 0,
    form.phoneWhatsapp.trim().length > 0,
  ];

  const stepTitles = [t("stepBusiness"), t("stepLocation"), t("stepPresence"), t("stepContact")];

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

  function goNext() {
    if (!stepValid[step]) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  return (
    <>
      <SiteHeader />
      <main>
        <Container narrow className="py-10 sm:py-16">
          <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>
          <p className="mt-2 text-text-secondary">{t("hook")}</p>

          <Panel raised className="mt-8">
            {loading ? (
              <ScanningIndicator label={t("scanningBody")} />
            ) : (
              <>
                <ProgressSteps
                  current={step}
                  total={TOTAL_STEPS}
                  label={t("stepOf", { current: step + 1, total: TOTAL_STEPS })}
                />

                <h2 className="mt-5 text-lg font-semibold text-ink">{stepTitles[step]}</h2>

                <form
                  onSubmit={step === TOTAL_STEPS - 1 ? handleSubmit : (e) => e.preventDefault()}
                  className="mt-5 flex flex-col gap-4"
                >
              {step === 0 && (
                <>
                  <div>
                    <Label htmlFor="businessName">{t("businessName")}</Label>
                    <Input
                      id="businessName"
                      required
                      autoFocus
                      value={form.businessName}
                      onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="niche">{t("niche")}</Label>
                    <Select
                      id="niche"
                      value={form.niche}
                      onChange={(e) => setForm({ ...form, niche: e.target.value })}
                    >
                      {NICHES.map((n) => (
                        <option key={n.value} value={n.value}>
                          {tNiches(n.value)}
                        </option>
                      ))}
                    </Select>
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <div>
                    <Label htmlFor="city">{t("city")}</Label>
                    <Input
                      id="city"
                      required
                      autoFocus
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="country">{t("country")}</Label>
                    <Select
                      id="country"
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value })}
                    >
                      {SUPPORTED_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {tCountries(c.code)}
                        </option>
                      ))}
                    </Select>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  {isApp && (
                    <>
                      <div>
                        <Label htmlFor="iosAppId">{t("iosAppId")}</Label>
                        <Input
                          id="iosAppId"
                          autoFocus
                          placeholder={t("iosAppIdPlaceholder")}
                          value={form.iosAppId}
                          onChange={(e) => setForm({ ...form, iosAppId: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="androidPackageId">{t("androidPackageId")}</Label>
                        <Input
                          id="androidPackageId"
                          placeholder={t("androidPackageIdPlaceholder")}
                          value={form.androidPackageId}
                          onChange={(e) => setForm({ ...form, androidPackageId: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <Label htmlFor="websiteUrl">{isApp ? t("websiteUrlApp") : t("websiteUrl")}</Label>
                    <Input
                      id="websiteUrl"
                      required={!isApp}
                      autoFocus={!isApp}
                      type="url"
                      placeholder={t("websiteUrlPlaceholder")}
                      value={form.websiteUrl}
                      onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                    />
                  </div>
                </>
              )}

              {step === 3 && (
                <div>
                  <Label htmlFor="whatsapp">{t("whatsapp")}</Label>
                  <Input
                    id="whatsapp"
                    required
                    autoFocus
                    placeholder={t("whatsappPlaceholder")}
                    value={form.phoneWhatsapp}
                    onChange={(e) => setForm({ ...form, phoneWhatsapp: e.target.value })}
                  />
                </div>
              )}

              {error && <Alert tone="critical">{error}</Alert>}

              <div className="mt-2 flex items-center justify-between gap-3">
                {step > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep((s) => Math.max(s - 1, 0))}
                  >
                    {t("back")}
                  </Button>
                ) : (
                  <span />
                )}

                {step < TOTAL_STEPS - 1 ? (
                  <Button type="button" onClick={goNext} disabled={!stepValid[step]}>
                    {t("next")}
                  </Button>
                ) : (
                  <Button type="submit" disabled={loading || !stepValid[step]}>
                    {t("submit")}
                  </Button>
                )}
              </div>
                </form>
              </>
            )}
          </Panel>
        </Container>
      </main>
    </>
  );
}
