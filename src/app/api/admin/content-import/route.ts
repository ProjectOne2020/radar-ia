import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin/is-admin";
import { validateImportPayload } from "@/lib/content-import/parse-import";
import { applyContentImport } from "@/lib/content-import/apply-import";

// M15 — herramienta interna del fundador (onboarding tecnico asistido), no self-serve
// del cliente: se sube el JSON generado en Antigravity para UN cliente a la vez.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { clientId, importJson } = body ?? {};

  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json({ error: "clientId requerido" }, { status: 400 });
  }
  if (!importJson || typeof importJson !== "string") {
    return NextResponse.json({ error: "importJson requerido (texto JSON crudo)" }, { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(importJson);
  } catch {
    return NextResponse.json({ error: "El texto no es JSON válido." }, { status: 400 });
  }

  const validation = validateImportPayload(parsed);
  if (!validation.valid || !validation.payload) {
    return NextResponse.json({ error: "Archivo inválido", details: validation.errors }, { status: 400 });
  }

  try {
    const result = await applyContentImport(clientId, validation.payload);
    return NextResponse.json({
      faqsInserted: result.faqsInserted,
      jsonLd: validation.payload.jsonLd,
      landing: validation.payload.landing,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
