import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp } from "@/lib/security/client-ip";
import { consumeRateLimit, tooManyRequests } from "@/lib/security/rate-limit";

// Solicitud publica de partner/agencia (seccion 8.3 de 01-CONTEXTO-NEGOCIO.md: "si una
// agencia insiste en usar la herramienta a escala, se le ofrece un tier de
// partner/reseller"). No hay auth de por medio (visitante anonimo) -> el insert pasa por
// admin client, igual que /api/free-audit/request; la tabla partner_applications tiene RLS
// habilitado sin policies, asi que anon/authenticated no pueden leerla ni escribirla directo.
export async function POST(request: Request) {
  // Formulario publico sin sesion: sin limite se podia inundar partner_applications
  // (y por lo tanto el panel de admin) con miles de solicitudes basura.
  const ip = getClientIp(request);
  const ipLimit = await consumeRateLimit({
    bucket: "partner_apply_ip",
    identifier: ip,
    limit: 3,
    windowSeconds: 24 * 60 * 60,
  });
  if (!ipLimit.allowed) {
    return tooManyRequests("Ya recibimos varias solicitudes desde esta conexión. Intenta mañana.", ipLimit.retryAfterSeconds);
  }

  const body = await request.json().catch(() => null);
  const { agencyName, contactName, email, phoneWhatsapp, websiteUrl, clientCount, message } = body ?? {};

  // Topes de longitud en cada campo: las columnas son `text` (sin limite en
  // Postgres), asi que sin esto un solo request podia insertar megabytes de texto
  // y crecer la base a voluntad.
  const withinLength = (value: unknown, max: number) =>
    typeof value !== "string" || value.length <= max;

  if (!agencyName || typeof agencyName !== "string" || agencyName.trim().length < 2 || agencyName.length > 120) {
    return NextResponse.json({ error: "Nombre de la agencia inválido." }, { status: 400 });
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
  if (!withinLength(websiteUrl, 500) || !withinLength(clientCount, 60) || !withinLength(message, 2000)) {
    return NextResponse.json({ error: "Alguno de los campos excede el largo permitido." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: application, error } = await admin
    .from("partner_applications")
    .insert({
      agency_name: agencyName.trim(),
      contact_name: contactName.trim(),
      email: email.trim(),
      phone_whatsapp: phoneWhatsapp,
      website_url: typeof websiteUrl === "string" ? websiteUrl.trim() || null : null,
      client_count: typeof clientCount === "string" ? clientCount.trim() || null : null,
      message: typeof message === "string" ? message.trim() || null : null,
    })
    .select("id")
    .single();

  if (error || !application) {
    return NextResponse.json({ error: "No se pudo enviar la solicitud." }, { status: 500 });
  }

  return NextResponse.json({ applicationId: application.id });
}
