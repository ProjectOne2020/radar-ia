import type { AuditFindingDraft } from "@/lib/audit/types";
import { fetchRawHtml, extractJsonLd } from "@/lib/audit/schema";
import type { MerchantProduct } from "./sync-feed";

// Limite razonable de landing pages a descargar por auditoria — un catalogo real puede
// tener cientos de SKUs, no tiene sentido (ni es barato) hacer fetch de todas en cada
// corrida periodica (M11 reusa este mismo codigo).
const MAX_PRODUCTS_TO_CROSSCHECK = 20;

// M14 — pilar 4 variante e-commerce (8%): GTIN + consistencia feed-vs-sitio, sustituye
// la jerarquia Organization->LocalBusiness->Servicios (02-METODOLOGIA-SCORING.md).
// "Si no coinciden, se registra como audit_finding de severidad warning" — nunca
// critical, es una discrepancia a revisar, no un fallo binario como robots.txt.
export async function crossCheckFeedVsSite(products: MerchantProduct[]): Promise<AuditFindingDraft[]> {
  const withLink = products.filter((p) => p.link).slice(0, MAX_PRODUCTS_TO_CROSSCHECK);
  if (withLink.length === 0) {
    return [
      {
        pillar: 4,
        finding: "Ningún producto del feed tiene un link de landing page para hacer cross-check contra schema.org.",
        severity: "info",
        detail_locked: true,
      },
    ];
  }

  let matched = 0;
  let gtinDeclared = 0;
  const mismatches: string[] = [];

  for (const product of withLink) {
    if (product.gtin || product.identifierExists === false) gtinDeclared += 1;

    const { fetched, html } = await fetchRawHtml(product.link!);
    if (!fetched) {
      mismatches.push(`${product.title}: no se pudo descargar la landing page`);
      continue;
    }

    const entities = extractJsonLd(html);
    const offerNode = entities.find((e) => e.type.includes("Product") || e.type.includes("Offer"));

    if (!offerNode) {
      mismatches.push(`${product.title}: sin schema Product/Offer en el sitio`);
      continue;
    }

    const raw = offerNode.raw;
    const offer = (raw.offers && typeof raw.offers === "object" ? raw.offers : raw) as Record<string, unknown>;
    const sitePrice = offer.price;
    const siteAvailability = typeof offer.availability === "string" ? offer.availability : undefined;

    const priceMatches =
      sitePrice !== undefined && product.price?.value !== undefined
        ? normalizePrice(sitePrice) === normalizePrice(product.price.value)
        : false;
    const availabilityMatches =
      siteAvailability !== undefined && product.availability !== undefined
        ? normalizeAvailability(siteAvailability) === normalizeAvailability(product.availability)
        : false;

    if (priceMatches && availabilityMatches) {
      matched += 1;
    } else {
      mismatches.push(
        `${product.title}: feed vs sitio no coincide (precio ${priceMatches ? "OK" : "distinto"}, disponibilidad ${availabilityMatches ? "OK" : "distinta"})`
      );
    }
  }

  const findings: AuditFindingDraft[] = [
    {
      pillar: 4,
      finding: `Cross-check feed vs sitio: ${matched}/${withLink.length} productos revisados coinciden en precio y disponibilidad.`,
      severity: matched === withLink.length ? "info" : "warning",
      detail_locked: false,
    },
    {
      pillar: 4,
      finding: `${gtinDeclared}/${withLink.length} productos del feed declaran GTIN o identifier_exists explícito.`,
      severity: gtinDeclared === withLink.length ? "info" : "warning",
      detail_locked: false,
    },
  ];

  if (mismatches.length > 0) {
    findings.push({
      pillar: 4,
      finding: `Detalle de discrepancias: ${mismatches.slice(0, 20).join(" | ")}`,
      severity: "info",
      detail_locked: true,
    });
  }

  return findings;
}

function normalizePrice(value: unknown): string {
  return String(value).replace(/[^\d.]/g, "");
}

function normalizeAvailability(value: string): "in_stock" | "out_of_stock" | "other" {
  const v = value.toLowerCase();
  if (v.includes("in_stock") || v.includes("in stock") || v.includes("instock")) return "in_stock";
  if (v.includes("out_of_stock") || v.includes("out of stock") || v.includes("outofstock")) return "out_of_stock";
  return "other";
}
