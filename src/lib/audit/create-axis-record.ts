import type { createAdminClient } from "@/lib/supabase/admin";

export type Axis = "local" | "ecommerce" | "app";

export interface AxisRecordInput {
  axis: Axis;
  businessName: string;
  city?: string;
  phoneWhatsapp?: string;
  websiteUrl?: string;
  iosAppId?: string;
  androidPackageId?: string;
  appType?: "native" | "web";
}

// M28 — extraido de run-free-audit.ts para reusar la misma logica de creacion de fila
// "donde vive el negocio" (locations/sku_catalogs/app_listings) tambien en el onboarding
// de clientes registrados directo (/registro), que hasta ahora no creaba ninguna —
// dejaba al cliente sin eje de scoring determinado y sin poder correr auditoria nunca.
// Una sola implementacion evita que las dos entradas (auditoria gratis vs. registro
// directo) diverjan en como arman esta fila.
export async function createAxisRecord(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
  input: AxisRecordInput,
): Promise<{ error?: string }> {
  if (input.axis === "app") {
    const { error } = await admin.from("app_listings").insert({
      client_id: clientId,
      app_name: input.businessName,
      ios_app_id: input.iosAppId ?? null,
      android_package_id: input.androidPackageId ?? null,
      landing_url: input.websiteUrl ?? null,
      app_type: input.appType ?? null,
    });
    if (error) return { error: `No se pudo registrar la app: ${error.message}` };
  } else if (input.axis === "ecommerce") {
    const { error } = await admin.from("sku_catalogs").insert({
      client_id: clientId,
      platform: "custom",
      store_url: input.websiteUrl,
      sku_count: null,
      merchant_center_id: null,
    });
    if (error) return { error: `No se pudo registrar la tienda: ${error.message}` };
  } else {
    const { error } = await admin.from("locations").insert({
      client_id: clientId,
      name: input.businessName,
      city: input.city,
      phone: input.phoneWhatsapp ?? null,
      website_url: input.websiteUrl,
      has_own_site: true,
    });
    if (error) return { error: `No se pudo registrar la sede: ${error.message}` };
  }
  return {};
}
