import type { createAdminClient } from "@/lib/supabase/admin";
import { buildFreeAuditPrompts, buildPromptsFromBank } from "@/lib/free-audit/prompts";

// Amplia el prompt_set activo de un cliente hasta `target` preguntas, sin duplicar las que
// ya existen. Compartido por upgradeAuditForClient (target segun el plan que de verdad
// pago) y el boton de auditoria completa de admin (target = tope maximo, sin pago real de
// por medio — herramienta interna). No hace nada si el cliente ya tiene `target` o mas.
export async function ensurePromptDepth(
  admin: ReturnType<typeof createAdminClient>,
  clientId: string,
  target: number,
): Promise<void> {
  const [{ data: client }, { data: existingPrompts }, { data: location }, { data: appListing }] = await Promise.all([
    admin.from("clients").select("business_name, niche, country").eq("id", clientId).single(),
    admin.from("prompt_sets").select("prompt_text").eq("client_id", clientId).eq("active", true),
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
}
