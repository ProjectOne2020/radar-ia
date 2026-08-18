import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin/is-admin";

// Aprobar -> verification_status='verified' (libera la cuenta).
// Rechazar -> mantiene 'flagged' explicitamente (el esquema solo documenta 3 estados —
// pending/verified/flagged — no hay un 4to estado "rechazado"; "flagged" ya representa
// una cuenta bloqueada, rechazar confirma la sospecha y la deja asi a proposito).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { clientId, action } = body ?? {};

  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json({ error: "clientId requerido" }, { status: 400 });
  }
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action debe ser 'approve' o 'reject'" }, { status: 400 });
  }

  if (action === "reject") {
    // No-op deliberado a nivel de estado — ver comentario arriba.
    return NextResponse.json({ clientId, verification_status: "flagged", note: "Cuenta confirmada como rechazada, permanece flagged." });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("clients").update({ verification_status: "verified" }).eq("id", clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ clientId, verification_status: "verified" });
}
