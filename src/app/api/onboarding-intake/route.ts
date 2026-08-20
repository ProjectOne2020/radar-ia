import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Pedido del fundador: justo despues de pagar (setup + suscripcion), pedir todo lo que el
// equipo necesita para implementar la primera mejora sugerida por la auditoria — contacto,
// como dar acceso al sitio, y si ya existe Google Business Profile. Nunca se pide una
// contraseña real aqui, solo la forma en la que el cliente prefiere darnos acceso.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });

  const { data, error } = await supabase.from("onboarding_intake").select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ intake: data });
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
  const {
    contactName,
    contactEmail,
    contactPhone,
    websitePlatform,
    websiteAccessMethod,
    inviteEmail,
    hasGbp,
    gbpNotes,
  } = body ?? {};

  if (!contactName || typeof contactName !== "string" || contactName.trim().length < 2) {
    return NextResponse.json({ error: "El nombre de contacto es requerido." }, { status: 400 });
  }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!contactEmail || typeof contactEmail !== "string" || !emailRe.test(contactEmail)) {
    return NextResponse.json({ error: "Correo de contacto inválido." }, { status: 400 });
  }
  if (websiteAccessMethod !== undefined && websiteAccessMethod !== null) {
    if (websiteAccessMethod !== "invite_us" && websiteAccessMethod !== "we_apply_changes") {
      return NextResponse.json({ error: "websiteAccessMethod inválido." }, { status: 400 });
    }
    if (websiteAccessMethod === "invite_us" && (!inviteEmail || !emailRe.test(inviteEmail))) {
      return NextResponse.json({ error: "Indica el correo con el que te invitamos como editor." }, { status: 400 });
    }
  }
  if (typeof hasGbp !== "boolean" && hasGbp !== null && hasGbp !== undefined) {
    return NextResponse.json({ error: "hasGbp debe ser true, false o vacío." }, { status: 400 });
  }

  const { data: existing } = await supabase.from("onboarding_intake").select("id").maybeSingle();

  const payload = {
    client_id: clientId,
    contact_name: contactName.trim(),
    contact_email: contactEmail.trim(),
    contact_phone: contactPhone ? String(contactPhone).trim() : null,
    website_platform: websitePlatform ? String(websitePlatform).trim() : null,
    website_access_method: websiteAccessMethod ?? null,
    invite_email: websiteAccessMethod === "invite_us" ? inviteEmail.trim() : null,
    has_gbp: typeof hasGbp === "boolean" ? hasGbp : null,
    gbp_notes: gbpNotes ? String(gbpNotes).trim() : null,
  };

  const { data, error } = existing
    ? await supabase.from("onboarding_intake").update(payload).eq("id", existing.id).select().single()
    : await supabase.from("onboarding_intake").insert(payload).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ intake: data });
}
