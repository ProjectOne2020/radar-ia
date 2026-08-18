import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CatalogForm from "./catalog-form";

// M14 — UI de dashboard adaptada a mostrar SKUs en vez de sedes, para el eje
// e-commerce (04-MODULOS-CONSTRUCCION.md M14). Tener una fila en sku_catalogs es lo que
// activa la variante e-commerce del score (pilares 2 y 4) — ver calculate-score.ts.
export default async function CatalogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: catalog } = await supabase.from("sku_catalogs").select("*").maybeSingle();

  return (
    <main style={{ padding: 60, maxWidth: 720, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/dashboard">← Volver</Link>
      </p>
      <h1>Catálogo de productos</h1>
      <p>
        Configura tu tienda para activar el score de la variante e-commerce (pilar 2: completitud del feed de
        Google Merchant Center; pilar 4: GTIN y consistencia feed-vs-sitio).
      </p>

      <CatalogForm catalog={catalog} />

      {catalog && (
        <p style={{ marginTop: 16, fontSize: 12, color: "#666" }}>
          {catalog.merchant_center_id
            ? "Merchant Center configurado — la próxima medición sincronizará el feed."
            : "Sin Merchant Center ID: el feed no se puede sincronizar todavía, solo se audita el sitio (robots.txt, schema)."}
        </p>
      )}
    </main>
  );
}
