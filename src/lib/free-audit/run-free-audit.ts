import { createAdminClient } from "@/lib/supabase/admin";
import { runMeasurementForPromptSet } from "@/lib/ai-engines/run-measurement";
import { runAuditForClient } from "@/lib/audit/run-audit";
import { calculateScoreForClient } from "@/lib/scoring/calculate-score";
import { buildFreeAuditPrompts, buildPromptsFromBank } from "./prompts";
import { extractDomain } from "@/lib/ai-engines/classify-domain";
import { currencyForCountry } from "@/lib/auth/country";
import { createAxisRecord } from "@/lib/audit/create-axis-record";

export type AuditAxis = "local" | "ecommerce" | "app";

export interface FreeAuditInput {
  businessName: string;
  // M23 — rubro libre: ya no esta limitado a un enum fijo (dental/estetica/inmobiliaria/
  // ecommerce/app). El eje de scoring (que tabla se crea, que variante de pilares 2/4/7
  // aplica) ya NO se infiere de este texto — viene explicito en `axis`.
  niche: string;
  axis: AuditAxis;
  city: string;
  country: string;
  // M16 — opcional cuando axis === "app" y el negocio solo tiene ficha de tienda, sin
  // landing propia (ver validacion en /api/free-audit/request). Tambien es el campo que
  // usa una app WEB para su URL (M23 — appType distingue nativa de web).
  websiteUrl?: string;
  phoneWhatsapp: string;
  // M23 — pedido explicito del fundador: la auditoria gratis debe pedir correo, no solo
  // WhatsApp. Se guarda en clients.email (columna ya existente, antes solo la llenaba
  // el registro pagado).
  email?: string;
  // M27 — opt-in explicito para el listado publico (05-MARKETING-DISTRIBUCION.md 2.3).
  // Default false: pedir la auditoria NO implica consentir a aparecer publicamente,
  // decision confirmada con el fundador (el documento original conflaba ambas cosas).
  publicListingOptIn?: boolean;
  // M13 — cuando la auditoria viene del endpoint de partners, se atribuye aqui
  // (columna clients.partner_id, agregada en M13 al schema literal de M6).
  partnerId?: string;
  // M16 — solo cuando axis === "app" y appType === "native" (M23).
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
// `app_listings`) + un prompt_set corto (5 preguntas) internos para poder correr los
// mismos motores reales que usa un cliente pagado — no se inventa una version "falsa"
// del score, es el mismo calculo con menos preguntas (04-MODULOS-CONSTRUCCION.md lo pide
// asi explicitamente: "una version ligera de M2+M3+M4", no una simulacion).
//
// M23 — el eje ahora es un campo explicito (input.axis), no se infiere comparando
// input.niche contra los strings literales "app"/"ecommerce": el rubro es texto libre
// desde el formulario ("no debe haber limitantes para que las personas puedan pedir su
// auditoria gratis"), asi que ya no puede usarse para decidir la tabla a crear.
export async function runFreeAudit(input: FreeAuditInput): Promise<FreeAuditRunResult> {
  const admin = createAdminClient();
  const isApp = input.axis === "app";

  // websiteUrl es obligatorio para local/e-commerce (domain debe resolver), pero opcional
  // para "app" (una app nativa puede no tener landing propia, solo fichas de tienda) — si
  // se provee, igual debe ser una URL valida.
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
      email: input.email ?? null,
      public_listing_opt_in: input.publicListingOptIn ?? false,
      verification_status: "pending",
      onboarding_type: input.partnerId ? "partner" : "self_serve",
      partner_id: input.partnerId ?? null,
    })
    .select("id")
    .single();

  if (clientError || !client) {
    throw new Error(`No se pudo crear el registro interno de auditoría: ${clientError?.message}`);
  }

  const { error: axisError } = await createAxisRecord(admin, client.id, {
    axis: input.axis,
    businessName: input.businessName,
    city: input.city,
    phoneWhatsapp: input.phoneWhatsapp,
    websiteUrl: input.websiteUrl,
    iosAppId: input.iosAppId,
    androidPackageId: input.androidPackageId,
  });
  if (axisError) throw new Error(axisError);

  const bankPrompts = await buildPromptsFromBank(input.niche, input.country, input.axis, input.city, 5);
  const promptTexts = bankPrompts ?? buildFreeAuditPrompts(input.niche, input.city, input.businessName, input.axis);
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
