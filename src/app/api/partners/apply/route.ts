import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Solicitud publica de partner/agencia (seccion 8.3 de 01-CONTEXTO-NEGOCIO.md: "si una
// agencia insiste en usar la herramienta a escala, se le ofrece un tier de
// partner/reseller"). No hay auth de por medio (visitante anonimo) -> el insert pasa por
// admin client, igual que /api/free-audit/request; la tabla partner_applications tiene RLS
// habilitado sin policies, asi que anon/authenticated no pueden leerla ni escribirla directo.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { agencyName, contactName, email, phoneWhatsapp, websiteUrl, clientCount, message } = body ?? {};

  if (!agencyName || typeof agencyName !== "string" || agencyName.trim().length < 2) {
    return NextResponse.json({ error: "Nombre de la agencia inválido." }, { status: 400 });
  }
  if (!contactName || typeof contactName !== "string" || contactName.trim().length < 2) {
    return NextResponse.json({ error: "Nombre de contacto inválido." }, { status: 400 });
  }
  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Correo inválido." }, { status: 400 });
  }
  if (!phoneWhatsapp || !/^\+\d{8,15}$/.test(phoneWhatsapp)) {
    return NextResponse.json({ error: "WhatsApp inválido (usa formato +52...)." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: application, error } = await admin
    .from("partner_applications")
    .insert({
      agency_name: agencyName.trim(),
      contact_name: contactName.trim(),
      email: email.trim(),
      phone_whatsapp: phoneWhatsapp,
      website_url: websiteUrl?.trim() || null,
      client_count: clientCount?.trim() || null,
      message: message?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !application) {
    return NextResponse.json({ error: "No se pudo enviar la solicitud." }, { status: 500 });
  }

  return NextResponse.json({ applicationId: application.id });
}
