import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin/is-admin";

// Cierra el ciclo de las comisiones "pending_manual": el admin ya le transfirio la plata a
// la agencia por fuera de la plataforma (transferencia, etc.) y lo marca aqui para que deje
// de aparecer como pendiente, tanto en /admin como en el panel de la agencia.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { commissionId } = body ?? {};
  if (!commissionId || typeof commissionId !== "string") {
    return NextResponse.json({ error: "commissionId requerido" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: commission } = await admin
    .from("partner_commissions")
    .select("id, status")
    .eq("id", commissionId)
    .maybeSingle();

  if (!commission) return NextResponse.json({ error: "Comisión no encontrada." }, { status: 404 });
  if (commission.status !== "pending_manual") {
    return NextResponse.json({ error: "Esta comisión ya no está pendiente." }, { status: 409 });
  }

  const { error } = await admin
    .from("partner_commissions")
    .update({ status: "paid_manual", paid_at: new Date().toISOString() })
    .eq("id", commissionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
