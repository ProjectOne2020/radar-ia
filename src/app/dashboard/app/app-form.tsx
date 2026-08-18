"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

interface AppListing {
  id: string;
  app_name: string;
  ios_app_id: string | null;
  android_package_id: string | null;
  landing_url: string | null;
}

export default function AppForm({ appListing }: { appListing: AppListing | null }) {
  const t = useTranslations("DashboardApp");
  const router = useRouter();
  const [appName, setAppName] = useState(appListing?.app_name ?? "");
  const [iosAppId, setIosAppId] = useState(appListing?.ios_app_id ?? "");
  const [androidPackageId, setAndroidPackageId] = useState(appListing?.android_package_id ?? "");
  const [landingUrl, setLandingUrl] = useState(appListing?.landing_url ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/dashboard/app-listing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appName,
        iosAppId: iosAppId.trim() || null,
        androidPackageId: androidPackageId.trim() || null,
        landingUrl: landingUrl.trim() || null,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? t("genericError"));
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="appName">{t("appName")}</Label>
        <Input id="appName" value={appName} onChange={(e) => setAppName(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="iosAppId">{t("iosAppId")}</Label>
        <Input
          id="iosAppId"
          value={iosAppId}
          onChange={(e) => setIosAppId(e.target.value)}
          placeholder={t("iosAppIdPlaceholder")}
        />
      </div>
      <div>
        <Label htmlFor="androidPackageId">{t("androidPackageId")}</Label>
        <Input
          id="androidPackageId"
          value={androidPackageId}
          onChange={(e) => setAndroidPackageId(e.target.value)}
          placeholder={t("androidPackageIdPlaceholder")}
        />
      </div>
      <div>
        <Label htmlFor="landingUrl">{t("landingUrl")}</Label>
        <Input
          id="landingUrl"
          type="url"
          value={landingUrl}
          onChange={(e) => setLandingUrl(e.target.value)}
          placeholder={t("landingUrlPlaceholder")}
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? t("saving") : appListing ? t("update") : t("create")}
      </Button>
      {error && <span className="text-sm text-critical">{error}</span>}
    </form>
  );
}
