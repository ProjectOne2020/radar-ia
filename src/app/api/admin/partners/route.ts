import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin/is-admin";
import { generatePartnerApiKey } from "@/lib/partners/api-key";

// El texto plano de la API key solo se devuelve aqui, en la respuesta de creacion —
// la DB solo guarda el hash (ver src/lib/partners/api-key.ts). Si se pierde, no se
// puede recuperar, solo regenerar (fuera de alcance del primer corte de M13).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { agencyName, revenueSharePct } = body ?? {};

  if (!agencyName || typeof agencyName !== "string" || agencyName.trim().length < 2) {
    return NextResponse.json({ error: "Nombre de la agencia inválido." }, { status: 400 });
  }
  if (revenueSharePct !== null && revenueSharePct !== undefined) {
    if (typeof revenueSharePct !== "number" || revenueSharePct < 0 || revenueSharePct > 100) {
      return NextResponse.json({ error: "revenueSharePct debe ser un número entre 0 y 100." }, { status: 400 });
    }
  }

  const { plaintext, hash } = generatePartnerApiKey();
  const admin = createAdminClient();
  const { data: partner, error } = await admin
    .from("partner_accounts")
    .insert({
      agency_name: agencyName.trim(),
      revenue_share_pct: revenueSharePct ?? null,
      api_key: hash,
      status: "active",
    })
    .select("id, agency_name, revenue_share_pct, status, created_at")
    .single();

  if (error || !partner) {
    return NextResponse.json({ error: error?.message ?? "No se pudo crear el partner." }, { status: 500 });
  }

  return NextResponse.json({ partner, apiKey: plaintext });
}
