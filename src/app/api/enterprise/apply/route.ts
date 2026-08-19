import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit, tooManyRequests } from "@/lib/security/rate-limit";

// M24 — solicitud publica de cotizacion Enterprise (boton "Contactar para cotización"
// de /precios, plan sin checkout automatico). Mismo patron que /api/partners/apply:
// visitante anonimo sin sesion -> insert via admin client, la tabla enterprise_leads
// tiene RLS habilitado sin policies (deny-by-default, solo service_role). La revision
// (cotizar/aprobar/cobrar) la hace el fundador en /admin/empresas.
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const ipLimit = await consumeRateLimit({
    bucket: "enterprise_apply_ip",
    identifier: ip,
    limit: 3,
    windowSeconds: 24 * 60 * 60,
  });
  if (!ipLimit.allowed) {
    return tooManyRequests("Ya recibimos varias solicitudes desde esta conexión. Intenta mañana.", ipLimit.retryAfterSeconds);
  }

  const body = await request.json().catch(() => null);
  const { businessName, contactName, email, phoneWhatsapp, websiteUrl, city, country, message } = body ?? {};

  const withinLength = (value: unknown, max: number) => typeof value !== "string" || value.length <= max;

  if (!businessName || typeof businessName !== "string" || businessName.trim().length < 2 || businessName.length > 120) {
    return NextResponse.json({ error: "Nombre del negocio inválido." }, { status: 400 });
  }
  if (!contactName || typeof contactName !== "string" || contactName.trim().length < 2 || contactName.length > 120) {
    return NextResponse.json({ error: "Nombre de contacto inválido." }, { status: 400 });
  }
  if (!email || typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Correo inválido." }, { status: 400 });
  }
  if (!phoneWhatsapp || !/^\+\d{8,15}$/.test(phoneWhatsapp)) {
    return NextResponse.json({ error: "WhatsApp inválido (usa formato +52...)." }, { status: 400 });
  }
  if (
    !withinLength(websiteUrl, 500) ||
    !withinLength(city, 120) ||
    !withinLength(country, 120) ||
    !withinLength(message, 2000)
  ) {
    return NextResponse.json({ error: "Alguno de los campos excede el largo permitido." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: lead, error } = await admin
    .from("enterprise_leads")
    .insert({
      business_name: businessName.trim(),
      contact_name: contactName.trim(),
      email: email.trim(),
      phone_whatsapp: phoneWhatsapp,
      website_url: typeof websiteUrl === "string" ? websiteUrl.trim() || null : null,
      city: typeof city === "string" ? city.trim() || null : null,
      country: typeof country === "string" ? country.trim() || null : null,
      message: typeof message === "string" ? message.trim() || null : null,
    })
    .select("id")
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: "No se pudo enviar la solicitud." }, { status: 500 });
  }

  return NextResponse.json({ leadId: lead.id });
}
