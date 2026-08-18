import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// M16 — el cliente gestiona su propia app (client_id via RLS, current_client_id()).
// Tener una fila aqui es la señal que run-audit.ts/calculate-score.ts usan para activar
// la variante apps del score (pilares 2, 4 y 7) — tiene precedencia sobre sku_catalogs
// si un cliente tuviera ambas.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });

  const { data, error } = await supabase.from("app_listings").select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ appListing: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });

  const clientId = user.app_metadata?.client_id as string | undefined;
  if (!clientId) return NextResponse.json({ error: "Sesión sin client_id." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { appName, iosAppId, androidPackageId, landingUrl } = body ?? {};

  if (!appName || typeof appName !== "string" || appName.trim().length < 2) {
    return NextResponse.json({ error: "appName requerido." }, { status: 400 });
  }
  if (!iosAppId && !androidPackageId) {
    return NextResponse.json({ error: "Debes indicar al menos ios_app_id o android_package_id." }, { status: 400 });
  }

  const { data: existing } = await supabase.from("app_listings").select("id").maybeSingle();

  const payload = {
    client_id: clientId,
    app_name: appName.trim(),
    ios_app_id: iosAppId || null,
    android_package_id: androidPackageId || null,
    landing_url: landingUrl || null,
  };

  const { data, error } = existing
    ? await supabase.from("app_listings").update(payload).eq("id", existing.id).select().single()
    : await supabase.from("app_listings").insert(payload).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ appListing: data });
}
