"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface Catalog {
  id: string;
  platform: string | null;
  store_url: string | null;
  sku_count: number | null;
  merchant_center_id: string | null;
}

export default function CatalogForm({ catalog }: { catalog: Catalog | null }) {
  const t = useTranslations("DashboardCatalogo");
  const router = useRouter();
  const [platform, setPlatform] = useState(catalog?.platform ?? "shopify");
  const [storeUrl, setStoreUrl] = useState(catalog?.store_url ?? "");
  const [skuCount, setSkuCount] = useState(catalog?.sku_count?.toString() ?? "");
  const [merchantCenterId, setMerchantCenterId] = useState(catalog?.merchant_center_id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/dashboard/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        storeUrl,
        skuCount: skuCount.trim() === "" ? null : Number(skuCount),
        merchantCenterId: merchantCenterId.trim() === "" ? null : merchantCenterId.trim(),
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
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 400 }}>
      <label>
        {t("platform")}
        <br />
        <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="shopify">Shopify</option>
          <option value="woocommerce">WooCommerce</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      <label>
        {t("storeUrl")}
        <br />
        <input
          type="url"
          value={storeUrl}
          onChange={(e) => setStoreUrl(e.target.value)}
          placeholder={t("storeUrlPlaceholder")}
          required
          style={{ width: "100%" }}
        />
      </label>
      <label>
        {t("skuCount")}
        <br />
        <input
          type="number"
          min={0}
          value={skuCount}
          onChange={(e) => setSkuCount(e.target.value)}
          style={{ width: "100%" }}
        />
      </label>
      <label>
        {t("merchantCenterId")}
        <br />
        <input
          value={merchantCenterId}
          onChange={(e) => setMerchantCenterId(e.target.value)}
          placeholder={t("merchantCenterIdPlaceholder")}
          style={{ width: "100%" }}
        />
      </label>
      <button type="submit" disabled={loading}>
        {loading ? t("saving") : catalog ? t("update") : t("create")}
      </button>
      {error && <span style={{ color: "red" }}>{error}</span>}
    </form>
  );
}
