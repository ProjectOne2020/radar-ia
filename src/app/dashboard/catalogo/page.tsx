import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import CatalogForm from "./catalog-form";

// M14 — UI de dashboard adaptada a mostrar SKUs en vez de sedes, para el eje
// e-commerce (04-MODULOS-CONSTRUCCION.md M14). Tener una fila en sku_catalogs es lo que
// activa la variante e-commerce del score (pilares 2 y 4) — ver calculate-score.ts.
export default async function CatalogPage() {
  const t = await getTranslations("DashboardCatalogo");
  const tCommon = await getTranslations("Common");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: catalog } = await supabase.from("sku_catalogs").select("*").maybeSingle();

  return (
    <main style={{ padding: 60, maxWidth: 720, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/dashboard">{tCommon("back")}</Link>
      </p>
      <h1>{t("title")}</h1>
      <p>{t("intro")}</p>

      <CatalogForm catalog={catalog} />

      {catalog && (
        <p style={{ marginTop: 16, fontSize: 12, color: "#666" }}>
          {catalog.merchant_center_id ? t("merchantCenterConfigured") : t("merchantCenterMissing")}
        </p>
      )}
    </main>
  );
}
