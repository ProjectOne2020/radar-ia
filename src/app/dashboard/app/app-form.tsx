"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AppListing {
  id: string;
  app_name: string;
  ios_app_id: string | null;
  android_package_id: string | null;
  landing_url: string | null;
}

export default function AppForm({ appListing }: { appListing: AppListing | null }) {
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
      setError(data.error ?? "Error");
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 400 }}>
      <label>
        Nombre de la app
        <br />
        <input value={appName} onChange={(e) => setAppName(e.target.value)} required style={{ width: "100%" }} />
      </label>
      <label>
        iOS App ID (Apple App Store)
        <br />
        <input
          value={iosAppId}
          onChange={(e) => setIosAppId(e.target.value)}
          placeholder="ej. 123456789"
          style={{ width: "100%" }}
        />
      </label>
      <label>
        Android Package ID (Google Play)
        <br />
        <input
          value={androidPackageId}
          onChange={(e) => setAndroidPackageId(e.target.value)}
          placeholder="ej. com.tuempresa.tuapp"
          style={{ width: "100%" }}
        />
      </label>
      <label>
        URL de landing/marketing de la app
        <br />
        <input
          type="url"
          value={landingUrl}
          onChange={(e) => setLandingUrl(e.target.value)}
          placeholder="opcional — https://tuapp.com"
          style={{ width: "100%" }}
        />
      </label>
      <button type="submit" disabled={loading}>
        {loading ? "Guardando..." : appListing ? "Actualizar app" : "Crear app"}
      </button>
      {error && <span style={{ color: "red" }}>{error}</span>}
    </form>
  );
}
