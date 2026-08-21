import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin/is-admin";
import { remeasureClientNow } from "@/lib/audit/remeasure-client";

// Corre de forma sincrona (no after()) a proposito: el boton de admin necesita saber si
// realmente termino para mostrar el resultado, a diferencia del webhook de Stripe que solo
// necesita responderle rapido a Stripe. maxDuration igual que el webhook — hasta 40
// preguntas x 4 motores de IA reales puede tardar varios minutos.
export const maxDuration = 300;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { clientId } = body ?? {};
  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json({ error: "clientId requerido" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  try {
    await remeasureClientNow(admin, clientId);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
