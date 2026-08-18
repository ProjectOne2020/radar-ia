import type { AuditFindingDraft } from "@/lib/audit/types";
import { getMerchantCenterAccessToken } from "./auth";

export interface MerchantProduct {
  offerId: string;
  title: string;
  link?: string;
  price?: { value: string; currency: string };
  availability?: string;
  gtin?: string;
  identifierExists?: boolean;
  brand?: string;
  description?: string;
}

export interface MerchantFeedResult {
  findings: AuditFindingDraft[];
  products: MerchantProduct[];
}

// M14 — pilar 2 variante e-commerce (20%): completitud del feed de Google Merchant
// Center, sustituye a Google Business Profile (02-METODOLOGIA-SCORING.md). Campos
// requeridos segun 03-ARQUITECTURA-TECNICA.md: title, description, brand, price (ISO
// 4217), availability, GTIN (o identifier_exists:false explicito si no aplica).
export async function auditMerchantFeed(
  merchantCenterId: string | null,
  businessName: string
): Promise<MerchantFeedResult> {
  const accountId = process.env.GOOGLE_MERCHANT_CENTER_ACCOUNT_ID;
  const accessToken = await getMerchantCenterAccessToken();

  if (!accountId || !accessToken) {
    return {
      products: [],
      findings: [
        {
          pillar: 2,
          finding:
            "Chequeo de Google Merchant Center no disponible: faltan GOOGLE_MERCHANT_CENTER_ACCOUNT_ID, GOOGLE_MERCHANT_CENTER_CLIENT_EMAIL o GOOGLE_MERCHANT_CENTER_PRIVATE_KEY.",
          severity: "info",
          detail_locked: true,
        },
      ],
    };
  }

  if (!merchantCenterId) {
    return {
      products: [],
      findings: [
        {
          pillar: 2,
          finding: `El negocio "${businessName}" no tiene un merchant_center_id configurado en su catálogo — no se puede sincronizar el feed.`,
          severity: "warning",
          detail_locked: false,
        },
      ],
    };
  }

  const res = await fetch(
    `https://shoppingcontent.googleapis.com/content/v2.1/${encodeURIComponent(merchantCenterId)}/products?maxResults=250`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const errText = await res.text();
    return {
      products: [],
      findings: [
        {
          pillar: 2,
          finding: `Error consultando Google Merchant Center API: ${res.status} — ${errText.slice(0, 300)}`,
          severity: "warning",
          detail_locked: true,
        },
      ],
    };
  }

  const data = await res.json();
  const rawProducts: Array<Record<string, unknown>> = data.resources ?? [];

  const products: MerchantProduct[] = rawProducts.map((p) => ({
    offerId: String(p.offerId ?? p.id ?? ""),
    title: typeof p.title === "string" ? p.title : "",
    link: typeof p.link === "string" ? p.link : undefined,
    price:
      p.price && typeof p.price === "object"
        ? (p.price as { value: string; currency: string })
        : undefined,
    availability: typeof p.availability === "string" ? p.availability : undefined,
    gtin: typeof p.gtin === "string" ? p.gtin : undefined,
    identifierExists: typeof p.identifierExists === "boolean" ? p.identifierExists : undefined,
    brand: typeof p.brand === "string" ? p.brand : undefined,
    description: typeof p.description === "string" ? p.description : undefined,
  }));

  if (products.length === 0) {
    return {
      products: [],
      findings: [
        {
          pillar: 2,
          finding: "El feed de Google Merchant Center no tiene productos activos.",
          severity: "critical",
          detail_locked: false,
        },
      ],
    };
  }

  let complete = 0;
  const missingByProduct: string[] = [];
  for (const p of products) {
    const missing: string[] = [];
    if (!p.title) missing.push("title");
    if (!p.description) missing.push("description");
    if (!p.brand) missing.push("brand");
    if (!p.price?.value || !isValidIso4217(p.price.currency)) missing.push("price (ISO 4217)");
    if (!p.availability) missing.push("availability");
    if (!p.gtin && p.identifierExists !== false) missing.push("GTIN o identifier_exists:false");

    if (missing.length === 0) complete += 1;
    else missingByProduct.push(`${p.title || p.offerId}: falta ${missing.join(", ")}`);
  }

  const findings: AuditFindingDraft[] = [
    {
      pillar: 2,
      finding: `Feed de Merchant Center: ${complete}/${products.length} productos con campos requeridos completos (title, description, brand, price, availability, GTIN o identifier_exists).`,
      severity: complete === products.length ? "info" : complete === 0 ? "critical" : "warning",
      detail_locked: false,
    },
  ];

  if (missingByProduct.length > 0) {
    findings.push({
      pillar: 2,
      finding: `Detalle de productos incompletos: ${missingByProduct.slice(0, 20).join(" | ")}`,
      severity: "info",
      detail_locked: true,
    });
  }

  return { findings, products };
}

function isValidIso4217(code: unknown): boolean {
  return typeof code === "string" && /^[A-Z]{3}$/.test(code);
}
