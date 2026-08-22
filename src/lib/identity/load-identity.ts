import type { createAdminClient } from "@/lib/supabase/admin";
import { extractDomain } from "@/lib/ai-engines/classify-domain";
import type { ClientIdentity, IdentityVariant } from "./types";

// P0.1 — Construye la identidad de un cliente desde la base de datos.
//
// Fuente unica: la usan tanto la medicion en vivo como el backfill del historico, para que
// no puedan divergir. Si el clasificador se comportara distinto en produccion que en el
// backfill, la clase almacenada dejaria de ser confiable.
//
// Dos origenes de variantes, siempre distinguibles:
//   - EXPLICITAS: filas de `client_identity_variants` (el cliente/admin las confirmo).
//   - DERIVADAS: dominios deducidos de locations/sku_catalogs/app_listings. Se marcan
//     'derived' porque nadie las confirmo; el clasificador les exige mas contexto antes de
//     tratarlas como prueba de identidad (ver requiresCorroboration).
export async function loadClientIdentity(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
): Promise<ClientIdentity | null> {
  const [
    { data: client },
    { data: explicitVariants },
    { data: locations },
    { data: skuCatalog },
    { data: appListing },
    { data: competitorLinks },
  ] = await Promise.all([
    admin.from("clients").select("id, business_name, niche").eq("id", clientId).maybeSingle(),
    admin.from("client_identity_variants").select("value, kind, source").eq("client_id", clientId),
    admin.from("locations").select("city, website_url").eq("client_id", clientId),
    admin.from("sku_catalogs").select("store_url").eq("client_id", clientId).maybeSingle(),
    admin.from("app_listings").select("app_name, landing_url").eq("client_id", clientId).maybeSingle(),
    admin.from("client_competitors").select("competitor_client_id").eq("client_id", clientId),
  ]);

  if (!client) return null;

  const variants: IdentityVariant[] = (explicitVariants ?? []).map((v) => ({
    value: v.value,
    kind: v.kind as IdentityVariant["kind"],
    source: (v.source as IdentityVariant["source"]) ?? "explicit",
  }));

  // Dominios derivados: cualquier URL que el cliente ya registro en su eje.
  const rawUrls = [
    ...(locations ?? []).map((l) => l.website_url),
    skuCatalog?.store_url ?? null,
    appListing?.landing_url ?? null,
  ].filter((u): u is string => Boolean(u));

  const seenDomains = new Set(
    variants.filter((v) => v.kind === "domain" || v.kind === "alt_domain").map((v) => v.value.toLowerCase()),
  );
  for (const url of rawUrls) {
    const domain = extractDomain(url);
    if (!domain || seenDomains.has(domain)) continue;
    seenDomains.add(domain);
    variants.push({ value: domain, kind: "domain", source: "derived" });
  }

  // Nombre de la app como marca derivada (solo si difiere del nombre comercial).
  if (appListing?.app_name && appListing.app_name.trim() !== client.business_name.trim()) {
    variants.push({ value: appListing.app_name, kind: "product_brand", source: "derived" });
  }

  // Competidores ya registrados (M7). Se usan solo para detectar comparativas.
  let competitorNames: string[] = [];
  const competitorIds = (competitorLinks ?? [])
    .map((c) => c.competitor_client_id)
    .filter((id): id is string => Boolean(id));
  if (competitorIds.length > 0) {
    const { data: competitors } = await admin
      .from("clients")
      .select("business_name")
      .in("id", competitorIds);
    competitorNames = (competitors ?? []).map((c) => c.business_name);
  }

  return {
    clientId: client.id,
    tradeName: client.business_name,
    legalName: null,
    city: (locations ?? [])[0]?.city ?? null,
    niche: client.niche,
    variants,
    competitorNames,
  };
}
