import type { createAdminClient } from "@/lib/supabase/admin";
import { buildFreeAuditPrompts, buildPromptsFromBank } from "@/lib/free-audit/prompts";
import { runMeasurementForPromptSet } from "@/lib/ai-engines/run-measurement";
import { runAuditForClient } from "./run-audit";
import { calculateScoreForClient } from "@/lib/scoring/calculate-score";

// 01-CONTEXTO-NEGOCIO.md seccion 4 da el numero de preguntas por plan como un RANGO
// (Lite "5-10", Plus "15-30") -- se usa el extremo superior de cada rango como el numero
// final una vez pagado (el extremo inferior es solo el arranque de la auditoria gratis).
// Pro no tiene un numero literal en el documento (solo "semanal" de cadencia) -- 40 es una
// extrapolacion, NO un numero confirmado por el fundador; ver nota en
// 04-MODULOS-CONSTRUCCION.md, ajustar si lo corrige.
const TARGET_PROMPT_COUNT: Record<string, number> = {
  lite: 10,
  plus: 30,
  pro: 40,
};

// Hueco encontrado por el fundador probando su propia cuenta real: pagar nunca ampliaba
// las preguntas de medicion mas alla de las 5 de la auditoria gratis original (el cron de
// M11 solo re-corre lo que ya existe, nunca lo aumenta). Se dispara desde el webhook de
// Stripe justo al confirmarse la suscripcion (type=subscription), una sola vez por cliente
// -- idempotente ante reintentos del webhook: si ya alcanzo el target, no hace nada.
export async function upgradeAuditForClient(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
  plan: string,
): Promise<void> {
  const target = TARGET_PROMPT_COUNT[plan];
  if (!target) return;

  const [{ data: client }, { data: existingPrompts }, { data: location }, { data: appListing }] = await Promise.all([
    admin.from("clients").select("business_name, niche, country").eq("id", clientId).single(),
    admin.from("prompt_sets").select("id, prompt_text").eq("client_id", clientId).eq("active", true),
    admin.from("locations").select("city").eq("client_id", clientId).maybeSingle(),
    admin.from("app_listings").select("id").eq("client_id", clientId).maybeSingle(),
  ]);
  if (!client) return;

  const currentCount = existingPrompts?.length ?? 0;
  if (currentCount >= target) return;

  const axis: "local" | "ecommerce" | "app" = appListing ? "app" : location ? "local" : "ecommerce";
  const city = location?.city ?? "";
  const needed = target - currentCount;

  const bankPrompts = await buildPromptsFromBank(client.niche, client.country, axis, city, target);
  const candidateTexts = bankPrompts ?? buildFreeAuditPrompts(client.niche, city, client.business_name, axis);

  const existingTexts = new Set((existingPrompts ?? []).map((p) => p.prompt_text));
  const newTexts = candidateTexts.filter((t) => !existingTexts.has(t)).slice(0, needed);

  if (newTexts.length > 0) {
    await admin
      .from("prompt_sets")
      .insert(newTexts.map((prompt_text) => ({ client_id: clientId, prompt_text, category: "general" })));
  }

  const { data: allActivePrompts } = await admin
    .from("prompt_sets")
    .select("id")
    .eq("client_id", clientId)
    .eq("active", true);

  await Promise.allSettled((allActivePrompts ?? []).map((p) => runMeasurementForPromptSet(p.id)));
  await runAuditForClient(clientId);
  await calculateScoreForClient(clientId);
}
