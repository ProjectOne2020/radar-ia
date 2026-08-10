import { createAdminClient } from "@/lib/supabase/admin";
import { runMeasurementForPromptSet } from "@/lib/ai-engines/run-measurement";
import { runAuditForClient } from "@/lib/audit/run-audit";
import { calculateScoreForClient } from "@/lib/scoring/calculate-score";

export interface AddCompetitorInput {
  ownerClientId: string;
  competitorName: string;
  city: string;
  websiteUrl: string;
}

// M7 — "un client_id interno tipo 'competidor'" (opcion que 04-MODULOS-CONSTRUCCION.md deja
// explicitamente autorizada): el competidor es una fila real de `clients`, sin auth.users
// ("sin crearles cuenta" tal como pide el documento), enlazada al dueño via
// client_competitors. Corre el mismo M2+M3+M4 real que un cliente pagado, usando las MISMAS
// preguntas activas del dueño — es lo que hace la comparacion justa (misma pregunta, mismo
// motor, mismo dia).
export async function addCompetitor(input: AddCompetitorInput): Promise<{ competitorClientId: string }> {
  const admin = createAdminClient();

  const { data: owner, error: ownerError } = await admin
    .from("clients")
    .select("niche, country, currency")
    .eq("id", input.ownerClientId)
    .single();

  if (ownerError || !owner) throw new Error(`No se encontró el cliente dueño: ${ownerError?.message}`);

  const { data: ownerPrompts, error: ownerPromptsError } = await admin
    .from("prompt_sets")
    .select("prompt_text")
    .eq("client_id", input.ownerClientId)
    .eq("active", true);

  if (ownerPromptsError) throw new Error(`No se pudieron leer las preguntas del cliente: ${ownerPromptsError.message}`);
  if (!ownerPrompts || ownerPrompts.length === 0) {
    throw new Error("El cliente no tiene preguntas activas todavía — no hay con qué comparar.");
  }

  const { data: competitor, error: competitorError } = await admin
    .from("clients")
    .insert({
      business_name: input.competitorName,
      niche: owner.niche,
      plan: "lite",
      country: owner.country,
      currency: owner.currency,
      // Placeholder deliberado: un competidor no es una cuenta real, nunca se le contacta.
      // clients.phone_whatsapp es NOT NULL por esquema, no hay valor "N/A" valido.
      phone_whatsapp: "+00000000000",
      verification_status: "pending",
      onboarding_type: "competitor_internal",
    })
    .select("id")
    .single();

  if (competitorError || !competitor) {
    throw new Error(`No se pudo crear el registro interno del competidor: ${competitorError?.message}`);
  }

  const { error: locationError } = await admin.from("locations").insert({
    client_id: competitor.id,
    name: input.competitorName,
    city: input.city,
    website_url: input.websiteUrl,
    has_own_site: true,
  });
  if (locationError) throw new Error(`No se pudo registrar la sede del competidor: ${locationError.message}`);

  const { data: competitorPrompts, error: competitorPromptsError } = await admin
    .from("prompt_sets")
    .insert(ownerPrompts.map((p) => ({ client_id: competitor.id, prompt_text: p.prompt_text, category: "comparacion" })))
    .select("id");

  if (competitorPromptsError || !competitorPrompts) {
    throw new Error(`No se pudieron crear las preguntas del competidor: ${competitorPromptsError?.message}`);
  }

  const { error: linkError } = await admin
    .from("client_competitors")
    .insert({ client_id: input.ownerClientId, competitor_client_id: competitor.id });
  if (linkError) throw new Error(`No se pudo enlazar el competidor: ${linkError.message}`);

  await Promise.allSettled(competitorPrompts.map((p) => runMeasurementForPromptSet(p.id)));
  await runAuditForClient(competitor.id);
  await calculateScoreForClient(competitor.id);

  return { competitorClientId: competitor.id };
}
