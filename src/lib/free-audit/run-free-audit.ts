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
  websiteUrl: string;
  phoneWhatsapp: string;
}

export interface FreeAuditRunResult {
  clientId: string;
  domain: string;
  scoreTotal: number;
}

// M6 — version ligera de M2+M3+M4 para la auditoria gratis publica. Crea un `clients` +
// `locations` + un prompt_set corto (5 preguntas) internos para poder correr los mismos
// motores reales que usa un cliente pagado — no se inventa una version "falsa" del score,
// es el mismo calculo con menos preguntas (04-MODULOS-CONSTRUCCION.md lo pide asi
// explicitamente: "una version ligera de M2+M3+M4", no una simulacion).
export async function runFreeAudit(input: FreeAuditInput): Promise<FreeAuditRunResult> {
  const admin = createAdminClient();
  const domain = extractDomain(input.websiteUrl);
  if (!domain) throw new Error("URL de sitio inválida.");

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
      onboarding_type: "self_serve",
    })
    .select("id")
    .single();

  if (clientError || !client) {
    throw new Error(`No se pudo crear el registro interno de auditoría: ${clientError?.message}`);
  }

  const { error: locationError } = await admin.from("locations").insert({
    client_id: client.id,
    name: input.businessName,
    city: input.city,
    phone: input.phoneWhatsapp,
    website_url: input.websiteUrl,
    has_own_site: true,
  });
  if (locationError) throw new Error(`No se pudo registrar la sede: ${locationError.message}`);

  const promptTexts = buildFreeAuditPrompts(input.niche, input.city);
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
