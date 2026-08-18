import { createAdminClient } from "@/lib/supabase/admin";
import type { ContentImportPayload } from "./types";

export interface ApplyImportResult {
  faqsInserted: number;
}

// M15 — unica escritura real en DB del import: las FAQs se insertan como prompt_sets
// (category:'imported' para distinguirlas de las que el cliente edita a mano), activas
// desde ya, para que la proxima corrida de M2/M3 (medicion + cobertura de preguntas,
// pilar 5) las use sin reescritura manual. jsonLd/landing no se persisten — ver
// src/lib/content-import/types.ts para por que.
export async function applyContentImport(
  clientId: string,
  payload: ContentImportPayload
): Promise<ApplyImportResult> {
  if (payload.faqs.length === 0) return { faqsInserted: 0 };

  const admin = createAdminClient();
  const { error, count } = await admin
    .from("prompt_sets")
    .insert(
      payload.faqs.map((faq) => ({
        client_id: clientId,
        prompt_text: faq.question,
        category: "imported",
        active: true,
      })),
      { count: "exact" }
    );

  if (error) throw new Error(`No se pudieron insertar las preguntas importadas: ${error.message}`);

  return { faqsInserted: count ?? payload.faqs.length };
}
