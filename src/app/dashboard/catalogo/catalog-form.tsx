"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input, Select, Label } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="platform">{t("platform")}</Label>
        <Select id="platform" value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="shopify">Shopify</option>
          <option value="woocommerce">WooCommerce</option>
          <option value="custom">Custom</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="storeUrl">{t("storeUrl")}</Label>
        <Input
          id="storeUrl"
          type="url"
          value={storeUrl}
          onChange={(e) => setStoreUrl(e.target.value)}
          placeholder={t("storeUrlPlaceholder")}
          required
        />
      </div>
      <div>
        <Label htmlFor="skuCount">{t("skuCount")}</Label>
        <Input
          id="skuCount"
          type="number"
          min={0}
          value={skuCount}
          onChange={(e) => setSkuCount(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="merchantCenterId">{t("merchantCenterId")}</Label>
        <Input
          id="merchantCenterId"
          value={merchantCenterId}
          onChange={(e) => setMerchantCenterId(e.target.value)}
          placeholder={t("merchantCenterIdPlaceholder")}
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? t("saving") : catalog ? t("update") : t("create")}
      </Button>
      {error && <span className="text-sm text-critical">{error}</span>}
    </form>
  );
}
