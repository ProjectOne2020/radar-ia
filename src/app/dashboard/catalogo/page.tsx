import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/panel";
import CatalogForm from "./catalog-form";

// M14 — UI de dashboard adaptada a mostrar SKUs en vez de sedes, para el eje
// e-commerce (04-MODULOS-CONSTRUCCION.md M14). Tener una fila en sku_catalogs es lo que
// activa la variante e-commerce del score (pilares 2 y 4) — ver calculate-score.ts.
export default async function CatalogPage() {
  const t = await getTranslations("DashboardCatalogo");
  const supabase = await createClient();

  const { data: catalog } = await supabase.from("sku_catalogs").select("*").maybeSingle();

  return (
    <>
      <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>
      <p className="mt-2 max-w-[64ch] text-text-secondary">{t("intro")}</p>

      <div className="mt-6 max-w-[420px]">
        <CatalogForm catalog={catalog} />
      </div>

      {catalog && (
        <Alert tone={catalog.merchant_center_id ? "good" : "neutral"} className="mt-6 max-w-[420px]">
          {catalog.merchant_center_id ? t("merchantCenterConfigured") : t("merchantCenterMissing")}
        </Alert>
      )}
    </>
  );
}
