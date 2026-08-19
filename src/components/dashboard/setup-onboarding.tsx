"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Panel, Alert } from "@/components/ui/panel";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ScanningIndicator } from "@/components/radar/scanning-indicator";

const AXES = ["local", "ecommerce", "app"] as const;

// M28 — cierra el hueco de /registro: un cliente self-serve llega al dashboard sin
// ninguna fila de eje (locations/sku_catalogs/app_listings) ni prompt_sets, así que nunca
// hay nada que medir. Este formulario es el mismo paso que ya resolvía runFreeAudit para
// la auditoría gratis, aplicado aquí a un cliente real ya autenticado — mismos campos
// (eje, ciudad, sitio/app), mismo motor real (M2+M3+M4) al enviar.
export function SetupOnboarding() {
  const t = useTranslations("DashboardSetup");
  const tAudit = useTranslations("AuditoriaGratis");
  const router = useRouter();
  const [form, setForm] = useState({
    axis: "local" as (typeof AXES)[number],
    appType: "web" as "web" | "native",
    city: "",
    websiteUrl: "",
    iosAppId: "",
    androidPackageId: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isApp = form.axis === "app";
  const isNativeApp = isApp && form.appType === "native";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/dashboard/setup", {
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
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Panel raised className="mt-8">
        <ScanningIndicator label={t("scanningBody")} />
      </Panel>
    );
  }

  return (
    <Panel raised className="mt-8">
      <h2 className="text-lg font-semibold text-ink">{t("title")}</h2>
      <p className="mt-1.5 text-sm text-text-secondary">{t("hook")}</p>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
        <div>
          <Label>{tAudit("axisLabel")}</Label>
          <div className="flex flex-wrap gap-2">
            {AXES.map((axis) => (
              <Button
                key={axis}
                type="button"
                size="sm"
                variant={form.axis === axis ? "primary" : "secondary"}
                onClick={() => setForm({ ...form, axis })}
              >
                {tAudit(`axis_${axis}`)}
              </Button>
            ))}
          </div>
        </div>

        {form.axis === "local" && (
          <div>
            <Label htmlFor="city">{tAudit("city")}</Label>
            <Input
              id="city"
              required
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>
        )}

        {isApp && (
          <div>
            <Label>{tAudit("appTypeLabel")}</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={!isNativeApp ? "primary" : "secondary"}
                onClick={() => setForm({ ...form, appType: "web" })}
              >
                {tAudit("appTypeWeb")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={isNativeApp ? "primary" : "secondary"}
                onClick={() => setForm({ ...form, appType: "native" })}
              >
                {tAudit("appTypeNative")}
              </Button>
            </div>
          </div>
        )}

        {isNativeApp && (
          <>
            <div>
              <Label htmlFor="iosAppId">{tAudit("iosAppId")}</Label>
              <Input
                id="iosAppId"
                placeholder={tAudit("iosAppIdPlaceholder")}
                value={form.iosAppId}
                onChange={(e) => setForm({ ...form, iosAppId: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="androidPackageId">{tAudit("androidPackageId")}</Label>
              <Input
                id="androidPackageId"
                placeholder={tAudit("androidPackageIdPlaceholder")}
                value={form.androidPackageId}
                onChange={(e) => setForm({ ...form, androidPackageId: e.target.value })}
              />
            </div>
          </>
        )}

        <div>
          <Label htmlFor="websiteUrl">{isApp ? tAudit("websiteUrlApp") : tAudit("websiteUrl")}</Label>
          <Input
            id="websiteUrl"
            required={!isNativeApp}
            type="url"
            placeholder={tAudit("websiteUrlPlaceholder")}
            value={form.websiteUrl}
            onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
          />
        </div>

        {error && <Alert tone="critical">{error}</Alert>}

        <Button type="submit" disabled={loading}>
          {t("submit")}
        </Button>
      </form>
    </Panel>
  );
}
