import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAxisRecord, type Axis } from "@/lib/audit/create-axis-record";
import { buildFreeAuditPrompts, buildPromptsFromBank } from "@/lib/free-audit/prompts";
import { runMeasurementForPromptSet } from "@/lib/ai-engines/run-measurement";
import { runAuditForClient } from "@/lib/audit/run-audit";
import { calculateScoreForClient } from "@/lib/scoring/calculate-score";
import { extractDomain } from "@/lib/ai-engines/classify-domain";

const VALID_AXES: Axis[] = ["local", "ecommerce", "app"];
// Lite (donde cae todo alta self-serve via /registro) mide "5-10 preguntas" segun
// 01-CONTEXTO-NEGOCIO.md seccion 4 — se usa el extremo alto porque este es el set
// inicial que queda activo para las re-mediciones periodicas de M11, no una muestra
// de una sola vez como la auditoria gratis (que usa 5).
const INITIAL_PROMPT_COUNT = 10;

export const maxDuration = 60;

// M28 — cierra el hueco de onboarding de /registro: un cliente que se da de alta
// self-serve (M5) nunca recibia ninguna fila de "donde vive el negocio" (locations/
// sku_catalogs/app_listings) ni ningun prompt_set — quedaba con el dashboard vacio para
// siempre, sin ninguna forma de arrancar su primera medicion. Este endpoint es el "M2+M3+M4
// ligero" que runFreeAudit ya hace, aplicado a un cliente REAL con sesion en vez de crear
// uno nuevo.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });

  const clientId = user.app_metadata?.client_id as string | undefined;
  if (!clientId) return NextResponse.json({ error: "Sesión sin client_id." }, { status: 401 });

  const admin = createAdminClient();

  // Idempotencia: si el cliente ya tiene alguna fila de eje, no se vuelve a crear (evita
  // duplicados si el formulario se reenvía) — el cliente ya paso por este setup antes.
  const [{ data: existingLocation }, { data: existingSku }, { data: existingApp }] = await Promise.all([
    admin.from("locations").select("id").eq("client_id", clientId).maybeSingle(),
    admin.from("sku_catalogs").select("id").eq("client_id", clientId).maybeSingle(),
    admin.from("app_listings").select("id").eq("client_id", clientId).maybeSingle(),
  ]);
  if (existingLocation || existingSku || existingApp) {
    return NextResponse.json({ error: "Este negocio ya tiene su configuración inicial hecha." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const { axis, appType, city, websiteUrl, iosAppId, androidPackageId } = body ?? {};

  if (!VALID_AXES.includes(axis)) {
    return NextResponse.json({ error: "Selecciona si es un negocio local, tienda online o app." }, { status: 400 });
  }

  const isApp = axis === "app";
  const isNativeApp = isApp && appType === "native";

  if (axis === "local" && (!city || typeof city !== "string" || city.trim().length < 2)) {
    return NextResponse.json({ error: "Ciudad requerida." }, { status: 400 });
  }
  if (isNativeApp) {
    if ((!iosAppId || typeof iosAppId !== "string") && (!androidPackageId || typeof androidPackageId !== "string")) {
      return NextResponse.json(
        { error: "Indica al menos el ID de App Store o el package de Google Play." },
        { status: 400 },
      );
    }
  } else if (!websiteUrl || typeof websiteUrl !== "string") {
    return NextResponse.json({ error: "Sitio web requerido." }, { status: 400 });
  }

  if (websiteUrl && !extractDomain(websiteUrl)) {
    return NextResponse.json({ error: "URL de sitio web inválida." }, { status: 400 });
  }

  const { data: client, error: clientFetchError } = await admin
    .from("clients")
    .select("business_name, niche, country, phone_whatsapp")
    .eq("id", clientId)
    .single();
  if (clientFetchError || !client) {
    return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 });
  }

  const { error: axisError } = await createAxisRecord(admin, clientId, {
    axis,
    businessName: client.business_name,
    city: city ? city.trim() : undefined,
    phoneWhatsapp: client.phone_whatsapp,
    websiteUrl: websiteUrl || undefined,
    iosAppId: iosAppId || undefined,
    androidPackageId: androidPackageId || undefined,
  });
  if (axisError) return NextResponse.json({ error: axisError }, { status: 500 });

  const bankPrompts = await buildPromptsFromBank(client.niche, client.country, axis, city ?? "", INITIAL_PROMPT_COUNT);
  const promptTexts =
    bankPrompts ?? buildFreeAuditPrompts(client.niche, city ?? "", client.business_name, axis).slice(0, INITIAL_PROMPT_COUNT);

  const { data: prompts, error: promptError } = await admin
    .from("prompt_sets")
    .insert(promptTexts.map((prompt_text: string) => ({ client_id: clientId, prompt_text, category: "general" })))
    .select("id");
  if (promptError || !prompts) {
    return NextResponse.json({ error: `No se pudieron crear las preguntas: ${promptError?.message}` }, { status: 500 });
  }

  await Promise.allSettled(prompts.map((p) => runMeasurementForPromptSet(p.id)));
  await runAuditForClient(clientId);
  const scoreResult = await calculateScoreForClient(clientId);

  return NextResponse.json({ scoreTotal: scoreResult.scoreTotal });
}
