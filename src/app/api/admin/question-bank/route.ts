import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin/is-admin";
import { RUBROS, QUESTION_BANK_COUNTRIES } from "@/lib/question-bank/taxonomy";

// M28 — panel de admin del banco de preguntas. Mismo patron de auth que el resto de
// /api/admin/*: sesion real + isAdminEmail, nunca el cliente de sesion para escribir
// (question_bank solo acepta escritura de service_role, ver migracion M28).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { action } = body ?? {};
  const admin = createAdminClient();

  if (action === "add") {
    const { rubro, country, questions } = body;
    const rubroDef = RUBROS.find((r) => r.slug === rubro);
    const countryDef = QUESTION_BANK_COUNTRIES.find((c) => c.code === country);
    if (!rubroDef || !countryDef) {
      return NextResponse.json({ error: "Rubro o país inválido." }, { status: 400 });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: "Se requiere al menos una pregunta." }, { status: 400 });
    }
    const rows = questions
      .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
      .map((q) => ({
        category_type: rubroDef.categoryType,
        rubro: rubroDef.slug,
        rubro_label: rubroDef.label,
        country: countryDef.code,
        question_text: q.trim(),
      }));
    if (rows.length === 0) {
      return NextResponse.json({ error: "No hay preguntas válidas para insertar." }, { status: 400 });
    }

    const { data, error } = await admin.from("question_bank").insert(rows).select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ inserted: data?.length ?? 0 });
  }

  if (action === "toggle") {
    const { id, active } = body;
    if (!id || typeof active !== "boolean") {
      return NextResponse.json({ error: "id y active son requeridos." }, { status: 400 });
    }
    const { error } = await admin.from("question_bank").update({ active }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ active });
  }

  if (action === "delete") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id requerido." }, { status: 400 });
    const { error } = await admin.from("question_bank").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ deleted: true });
  }

  return NextResponse.json({ error: "action debe ser 'add', 'toggle' o 'delete'." }, { status: 400 });
}
