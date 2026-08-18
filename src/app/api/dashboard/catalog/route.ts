import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_PLATFORMS = new Set(["shopify", "woocommerce", "custom"]);

// M14 — el cliente gestiona su propio catalogo (client_id via RLS, current_client_id()).
// Tener una fila aqui es la señal que run-audit.ts/calculate-score.ts usan para activar
// la variante e-commerce del score (pilares 2 y 4).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });

  const { data, error } = await supabase.from("sku_catalogs").select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ catalog: data });
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
  const { platform, storeUrl, skuCount, merchantCenterId } = body ?? {};

  if (!VALID_PLATFORMS.has(platform)) {
    return NextResponse.json({ error: "platform debe ser 'shopify', 'woocommerce' o 'custom'." }, { status: 400 });
  }
  if (!storeUrl || typeof storeUrl !== "string") {
    return NextResponse.json({ error: "storeUrl requerido." }, { status: 400 });
  }
  if (skuCount !== null && skuCount !== undefined && (typeof skuCount !== "number" || skuCount < 0)) {
    return NextResponse.json({ error: "skuCount debe ser un número no negativo." }, { status: 400 });
  }

  const { data: existing } = await supabase.from("sku_catalogs").select("id").maybeSingle();

  const payload = {
    client_id: clientId,
    platform,
    store_url: storeUrl,
    sku_count: skuCount ?? null,
    merchant_center_id: merchantCenterId || null,
  };

  const { data, error } = existing
    ? await supabase.from("sku_catalogs").update(payload).eq("id", existing.id).select().single()
    : await supabase.from("sku_catalogs").insert(payload).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ catalog: data });
}
