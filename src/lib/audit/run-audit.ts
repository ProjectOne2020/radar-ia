import { createAdminClient } from "@/lib/supabase/admin";
import { auditRobotsTxt } from "./robots";
import { fetchRawHtml, extractJsonLd, auditSchema } from "./schema";
import { auditNapConsistency } from "./nap";
import { auditGoogleBusinessProfile } from "./gbp";
import { auditBingIndexation } from "./bing-indexation";
import { auditQuestionCoverage } from "./question-coverage";
import { auditMerchantFeed } from "@/lib/merchant-center/sync-feed";
import { crossCheckFeedVsSite } from "@/lib/merchant-center/cross-check";
import { auditAppListing } from "@/lib/app-stores/audit-app-listing";
import { auditAppSchema } from "@/lib/app-stores/audit-app-schema";
import type { AuditFindingDraft } from "./types";

export interface AuditSummary {
  clientId: string;
  locationsAudited: number;
  findingsInserted: number;
  errors: string[];
}

// M3 — audita la huella digital publica de un cliente (todas sus sedes con sitio propio)
// e inserta los hallazgos en audit_findings.
export async function runAuditForClient(clientId: string): Promise<AuditSummary> {
  const admin = createAdminClient();

  const [
    { data: client, error: clientError },
    { data: locations, error: locationsError },
    { data: activePrompts, error: promptsError },
    { data: skuCatalog, error: skuCatalogError },
    { data: appListing, error: appListingError },
  ] = await Promise.all([
    admin.from("clients").select("business_name").eq("id", clientId).single(),
    admin.from("locations").select("name, website_url, phone, address, city").eq("client_id", clientId),
    admin.from("prompt_sets").select("prompt_text").eq("client_id", clientId).eq("active", true),
    admin.from("sku_catalogs").select("id, store_url, merchant_center_id").eq("client_id", clientId).maybeSingle(),
    admin
      .from("app_listings")
      .select("id, app_name, ios_app_id, android_package_id, landing_url")
      .eq("client_id", clientId)
      .maybeSingle(),
  ]);

  if (clientError || !client) {
    throw new Error(`No se encontro el cliente ${clientId}: ${clientError?.message ?? "not found"}`);
  }
  if (locationsError) {
    throw new Error(`No se pudieron leer las sedes del cliente ${clientId}: ${locationsError.message}`);
  }
  if (promptsError) {
    throw new Error(`No se pudieron leer los prompts del cliente ${clientId}: ${promptsError.message}`);
  }
  if (skuCatalogError) {
    throw new Error(`No se pudo leer el catalogo del cliente ${clientId}: ${skuCatalogError.message}`);
  }
  if (appListingError) {
    throw new Error(`No se pudo leer la app del cliente ${clientId}: ${appListingError.message}`);
  }

  const summary: AuditSummary = { clientId, locationsAudited: 0, findingsInserted: 0, errors: [] };
  const allFindings: AuditFindingDraft[] = [];

  const sitesWithUrl = (locations ?? []).filter((l) => l.website_url);
  // M16 — si un cliente tuviera fila en ambas tablas (vende productos Y tiene una app),
  // el eje app tiene precedencia para pilares 2/4/7 — decision explicita del fundador,
  // misma regla aplicada en calculate-score.ts.
  const isApp = !!appListing;
  const isEcommerce = !isApp && !!skuCatalog;

  if (sitesWithUrl.length === 0 && !skuCatalog?.store_url && !appListing?.landing_url) {
    allFindings.push({
      pillar: 3,
      finding: "El cliente no tiene ninguna sede, tienda ni landing de app con sitio web registrado — no se puede auditar crawlability ni schema.",
      severity: "critical",
      detail_locked: false,
    });
  }

  for (const location of sitesWithUrl) {
    const websiteUrl = location.website_url as string;
    summary.locationsAudited += 1;

    try {
      const robotsResult = await auditRobotsTxt(websiteUrl);
      allFindings.push(...robotsResult.findings);
    } catch (err) {
      summary.errors.push(`robots.txt (${websiteUrl}): ${err instanceof Error ? err.message : String(err)}`);
    }

    let fetchedHtml = { fetched: false, html: "" };
    try {
      fetchedHtml = await fetchRawHtml(websiteUrl);
      allFindings.push(...auditSchema(fetchedHtml.html, fetchedHtml.fetched));

      if (fetchedHtml.fetched) {
        const entities = extractJsonLd(fetchedHtml.html);
        allFindings.push(...auditNapConsistency(entities, location));
      }
    } catch (err) {
      summary.errors.push(`schema/NAP (${websiteUrl}): ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      allFindings.push(
        ...(await auditQuestionCoverage(fetchedHtml.html, fetchedHtml.fetched, activePrompts ?? []))
      );
    } catch (err) {
      summary.errors.push(`cobertura de preguntas (${websiteUrl}): ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      allFindings.push(...(await auditBingIndexation(websiteUrl)));
    } catch (err) {
      summary.errors.push(`Bing (${websiteUrl}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // M14 — sitio de la tienda de un cliente e-commerce: mismas auditorias de
  // robots/schema/cobertura/Bing que una sede, pero sin NAP (sku_catalogs no tiene
  // nombre/telefono/direccion que comparar — pilar 1 queda measured:false para el eje
  // e-commerce puro, honesto con la convencion ya establecida en vez de inventar un NAP).
  if (skuCatalog?.store_url && !isApp) {
    const websiteUrl = skuCatalog.store_url;
    summary.locationsAudited += 1;

    try {
      const robotsResult = await auditRobotsTxt(websiteUrl);
      allFindings.push(...robotsResult.findings);
    } catch (err) {
      summary.errors.push(`robots.txt (${websiteUrl}): ${err instanceof Error ? err.message : String(err)}`);
    }

    let fetchedHtml = { fetched: false, html: "" };
    try {
      fetchedHtml = await fetchRawHtml(websiteUrl);
      allFindings.push(...auditSchema(fetchedHtml.html, fetchedHtml.fetched));
    } catch (err) {
      summary.errors.push(`schema (${websiteUrl}): ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      allFindings.push(
        ...(await auditQuestionCoverage(fetchedHtml.html, fetchedHtml.fetched, activePrompts ?? []))
      );
    } catch (err) {
      summary.errors.push(`cobertura de preguntas (${websiteUrl}): ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      allFindings.push(...(await auditBingIndexation(websiteUrl)));
    } catch (err) {
      summary.errors.push(`Bing (${websiteUrl}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // M16 — landing page de una app: mismas auditorias de robots/cobertura/Bing que una
  // sede, mas el chequeo especifico de schema SoftwareApplication (pilar 4) en vez del
  // generico Organization/Product. landing_url es opcional (una app chica puede no tener
  // sitio propio, solo fichas de tienda) — si no esta, se omite este bloque entero, sin
  // inventar una URL.
  if (isApp && appListing?.landing_url) {
    const websiteUrl = appListing.landing_url;
    summary.locationsAudited += 1;

    try {
      const robotsResult = await auditRobotsTxt(websiteUrl);
      allFindings.push(...robotsResult.findings);
    } catch (err) {
      summary.errors.push(`robots.txt (${websiteUrl}): ${err instanceof Error ? err.message : String(err)}`);
    }

    let fetchedHtml = { fetched: false, html: "" };
    try {
      fetchedHtml = await fetchRawHtml(websiteUrl);
      allFindings.push(...auditAppSchema(fetchedHtml.html, fetchedHtml.fetched));
    } catch (err) {
      summary.errors.push(`schema app (${websiteUrl}): ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      allFindings.push(
        ...(await auditQuestionCoverage(fetchedHtml.html, fetchedHtml.fetched, activePrompts ?? []))
      );
    } catch (err) {
      summary.errors.push(`cobertura de preguntas (${websiteUrl}): ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      allFindings.push(...(await auditBingIndexation(websiteUrl)));
    } catch (err) {
      summary.errors.push(`Bing (${websiteUrl}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Pilar 2: Google Business Profile (local), Google Merchant Center (e-commerce) o
  // ficha de tienda de apps (apps) — son sustitutos, nunca se corren dos para el mismo
  // cliente (02-METODOLOGIA-SCORING.md).
  if (isApp) {
    try {
      allFindings.push(
        ...(await auditAppListing(
          appListing?.app_name ?? client.business_name,
          appListing?.ios_app_id ?? null,
          appListing?.android_package_id ?? null
        ))
      );
    } catch (err) {
      summary.errors.push(`App stores: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else if (isEcommerce) {
    try {
      const feedResult = await auditMerchantFeed(skuCatalog?.merchant_center_id ?? null, client.business_name);
      allFindings.push(...feedResult.findings);

      if (feedResult.products.length > 0) {
        allFindings.push(...(await crossCheckFeedVsSite(feedResult.products)));
      }
    } catch (err) {
      summary.errors.push(`Merchant Center: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    for (const location of locations ?? []) {
      try {
        allFindings.push(
          ...(await auditGoogleBusinessProfile({
            businessName: client.business_name,
            city: location.city,
          }))
        );
      } catch (err) {
        summary.errors.push(`GBP (${location.name}): ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  if (allFindings.length > 0) {
    const { error: insertError, count } = await admin
      .from("audit_findings")
      .insert(
        allFindings.map((f) => ({
          client_id: clientId,
          pillar: f.pillar,
          finding: f.finding,
          severity: f.severity,
          detail_locked: f.detail_locked,
        })),
        { count: "exact" }
      );

    if (insertError) {
      summary.errors.push(`Insercion de audit_findings: ${insertError.message}`);
    } else {
      summary.findingsInserted = count ?? allFindings.length;
    }
  }

  return summary;
}
