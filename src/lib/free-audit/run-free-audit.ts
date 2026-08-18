import { createAdminClient } from "@/lib/supabase/admin";
import { runMeasurementForPromptSet } from "@/lib/ai-engines/run-measurement";
import { runAuditForClient } from "@/lib/audit/run-audit";
import { calculateScoreForClient } from "@/lib/scoring/calculate-score";
import { buildFreeAuditPrompts } from "./prompts";
import { extractDomain } from "@/lib/ai-engines/classify-domain";
import { currencyForCountry } from "@/lib/auth/country";

export interface FreeAuditInput {
  businessName: string;
  niche: string;
  city: string;
  country: string;
  // M16 — opcional cuando niche === "app" y el negocio solo tiene ficha de tienda, sin
  // landing propia (ver validacion en /api/free-audit/request).
  websiteUrl?: string;
  phoneWhatsapp: string;
  // M13 — cuando la auditoria viene del endpoint de partners, se atribuye aqui
  // (columna clients.partner_id, agregada en M13 al schema literal de M6).
  partnerId?: string;
  // M16 — solo para niche === "app".
  iosAppId?: string;
  androidPackageId?: string;
}

export interface FreeAuditRunResult {
  clientId: string;
  // M16 — null cuando es una app sin landing propia (solo fichas de tienda).
  domain: string | null;
  scoreTotal: number;
}

// M6 — version ligera de M2+M3+M4 para la auditoria gratis publica. Crea un `clients` +
// un registro de "donde vive el negocio" (segun el eje: `locations`, `sku_catalogs` o
// `app_listings` — M16 agrega la bifurcacion por niche, antes SIEMPRE se creaba
// `locations` incluso para niche "ecommerce", lo cual dejaba la auditoria gratis sin
// activar nunca la variante e-commerce del score; se corrige aqui de paso) + un
// prompt_set corto (5 preguntas) internos para poder correr los mismos motores reales que
// usa un cliente pagado — no se inventa una version "falsa" del score, es el mismo
// calculo con menos preguntas (04-MODULOS-CONSTRUCCION.md lo pide asi explicitamente:
// "una version ligera de M2+M3+M4", no una simulacion).
export async function runFreeAudit(input: FreeAuditInput): Promise<FreeAuditRunResult> {
  const admin = createAdminClient();
  const isApp = input.niche === "app";
  const isEcommerce = input.niche === "ecommerce";

  // websiteUrl es obligatorio para local/e-commerce (domain debe resolver), pero opcional
  // para "app" (una app puede no tener landing propia, solo fichas de tienda) — si se
  // provee, igual debe ser una URL valida.
  const domain = input.websiteUrl ? extractDomain(input.websiteUrl) : null;
  if (!domain && (!isApp || input.websiteUrl)) throw new Error("URL de sitio inválida.");

  const { data: client, error: clientError } = await admin
    .from("clients")
    .insert({
      business_name: input.businessName,
      niche: input.niche,
      plan: "lite",
      country: input.country,
      currency: currencyForCountry(input.country),
      phone_whatsapp: input.phoneWhatsapp,
      verification_status: "pending",
      onboarding_type: input.partnerId ? "partner" : "self_serve",
      partner_id: input.partnerId ?? null,
    })
    .select("id")
    .single();

  if (clientError || !client) {
    throw new Error(`No se pudo crear el registro interno de auditoría: ${clientError?.message}`);
  }

  if (isApp) {
    const { error: appError } = await admin.from("app_listings").insert({
      client_id: client.id,
      app_name: input.businessName,
      ios_app_id: input.iosAppId ?? null,
      android_package_id: input.androidPackageId ?? null,
      landing_url: input.websiteUrl ?? null,
    });
    if (appError) throw new Error(`No se pudo registrar la app: ${appError.message}`);
  } else if (isEcommerce) {
    const { error: skuError } = await admin.from("sku_catalogs").insert({
      client_id: client.id,
      platform: "custom",
      store_url: input.websiteUrl,
      sku_count: null,
      merchant_center_id: null,
    });
    if (skuError) throw new Error(`No se pudo registrar la tienda: ${skuError.message}`);
  } else {
    const { error: locationError } = await admin.from("locations").insert({
      client_id: client.id,
      name: input.businessName,
      city: input.city,
      phone: input.phoneWhatsapp,
      website_url: input.websiteUrl,
      has_own_site: true,
    });
    if (locationError) throw new Error(`No se pudo registrar la sede: ${locationError.message}`);
  }

  const promptTexts = buildFreeAuditPrompts(input.niche, input.city, input.businessName);
  const { data: prompts, error: promptError } = await admin
    .from("prompt_sets")
    .insert(promptTexts.map((prompt_text) => ({ client_id: client.id, prompt_text, category: "general" })))
    .select("id");

  if (promptError || !prompts) throw new Error(`No se pudieron crear las preguntas: ${promptError?.message}`);

  // M2 ligero: corre los prompts en paralelo contra los 4 motores reales.
  await Promise.allSettled(prompts.map((p) => runMeasurementForPromptSet(p.id)));

  // M3: auditoria tecnica completa (robots, schema, NAP, GBP nivel 1, Bing, cobertura).
  await runAuditForClient(client.id);

  // M4: calculo del score con los pesos exactos.
  const scoreResult = await calculateScoreForClient(client.id);

  return { clientId: client.id, domain, scoreTotal: scoreResult.scoreTotal };
}
