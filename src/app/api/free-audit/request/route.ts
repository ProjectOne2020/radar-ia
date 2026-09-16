import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkFreeAuditRateLimit, getClientIp } from "@/lib/free-audit/rate-limit";
import { runFreeAudit, type AuditAxis } from "@/lib/free-audit/run-free-audit";
import { extractDomain } from "@/lib/ai-engines/classify-domain";
import { assertHttpUrlFormat } from "@/lib/security/public-url";

const VALID_AXES: AuditAxis[] = ["local", "ecommerce", "app"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Corre M2 ligero (llamadas reales a los motores activos) + M3 + M4 de forma sincrona.
//
// P0.2-B — 60s se quedaron cortos. Con el reintento de celdas fallidas el peor caso
// estimado sube a ~55-70s (base medida en produccion ~16-21s, mas hasta 2 rondas de
// reintento y la auditoria tecnica del sitio del cliente). Si la funcion muere antes de
// closeSession(), no hay trabajo en segundo plano que la termine: la sesion queda `running`,
// nunca se escribe el snapshot y el prospecto ve un 404 PERMANENTE en su reporte.
//
// 300 deja ~5x de margen y es el mismo valor que ya usan /api/admin/remeasure,
// /api/cron/remeasure y el webhook de Stripe.
//
// PENDIENTE (fuera del alcance de P0.2-B): una peticion HTTP sincrona de hasta 300s es
// fragil y mala UX. La solucion correcta es hacer la auditoria gratis asincrona (respuesta
// inmediata + polling), pero eso es un cambio de arquitectura.
export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const {
    businessName,
    niche,
    axis,
    appType,
    city,
    country,
    websiteUrl,
    phoneWhatsapp,
    email,
    publicListingOptIn,
    iosAppId,
    androidPackageId,
  } = body ?? {};

  if (!businessName || typeof businessName !== "string" || businessName.trim().length < 2) {
    return NextResponse.json({ error: "Nombre del negocio inválido." }, { status: 400 });
  }
  // M23 — rubro libre: ya no es un enum fijo, cualquier negocio puede escribir el suyo
  // ("no debe haber limitantes para que las personas puedan pedir su auditoría gratis").
  if (!niche || typeof niche !== "string" || niche.trim().length < 2 || niche.length > 120) {
    return NextResponse.json({ error: "Indica el tipo de negocio." }, { status: 400 });
  }
  if (!VALID_AXES.includes(axis)) {
    return NextResponse.json({ error: "Selecciona si es un negocio local, tienda online o app." }, { status: 400 });
  }
  if (!city || typeof city !== "string" || city.trim().length < 2) {
    return NextResponse.json({ error: "Ciudad requerida." }, { status: 400 });
  }
  if (!country || typeof country !== "string") {
    return NextResponse.json({ error: "País requerido." }, { status: 400 });
  }
  // El regex nunca estuvo limitado a Mexico (+CODIGO + 8-15 digitos acepta cualquier pais) —
  // el bug real es que no toleraba espacios, y la gente los escribe naturalmente al tipear un
  // numero ("+57 312 3742397"). Se normaliza aqui (unica fuente de verdad: todo lo que se
  // guarda y se usa despues —free_audits, clients, rate-limit dedup— usa este valor limpio,
  // nunca el crudo del formulario) en vez de solo relajar la validacion y guardar el crudo.
  const normalizedPhone = typeof phoneWhatsapp === "string" ? phoneWhatsapp.replace(/[\s\-().]/g, "") : "";
  if (!normalizedPhone || !/^\+\d{8,15}$/.test(normalizedPhone)) {
    return NextResponse.json(
      { error: "Teléfono de WhatsApp inválido — usa formato internacional, ej. +52, +57, +54... seguido del número." },
      { status: 400 },
    );
  }
  // M?? — el correo pasa a ser opcional (pedido explicito: "si no tiene web o no tiene
  // correo debe igual dejar seguir con la auditoria"), pero si se provee debe ser valido.
  if (email !== undefined && email !== null && email !== "" && (typeof email !== "string" || email.length > 254 || !EMAIL_RE.test(email))) {
    return NextResponse.json({ error: "Correo inválido." }, { status: 400 });
  }
  if (publicListingOptIn !== undefined && typeof publicListingOptIn !== "boolean") {
    return NextResponse.json({ error: "publicListingOptIn debe ser true o false." }, { status: 400 });
  }

  const isApp = axis === "app";
  // M23 — dentro del eje app, se distingue app nativa (pide ficha de tienda) de app web
  // (solo necesita URL, como cualquier sitio) — antes CUALQUIER niche "app" exigia ID de
  // App Store/Google Play aunque fuera una app web sin presencia en tiendas.
  const isNativeApp = isApp && appType === "native";

  if (isNativeApp) {
    if ((!iosAppId || typeof iosAppId !== "string") && (!androidPackageId || typeof androidPackageId !== "string")) {
      return NextResponse.json(
        { error: "Indica al menos el ID de App Store o el package de Google Play." },
        { status: 400 }
      );
    }
  }
  // M?? — el sitio web pasa a ser opcional para local/ecommerce tambien (mismo pedido:
  // negocios sin pagina web deben poder completar la auditoria). Sin sitio, se usa una
  // clave de dedup sintetica analoga a la de app nativa sin landing.

  let domain: string | null = null;
  if (websiteUrl) {
    // Validacion temprana de formato (protocolo http(s), sin credenciales embebidas) antes
    // de tocar la red. La validacion de red (IP privada/loopback/metadata) vive en el punto
    // de fetch, en fetchWithLimits — esto solo adelanta el rechazo de lo claramente invalido.
    try {
      assertHttpUrlFormat(websiteUrl);
    } catch {
      return NextResponse.json({ error: "URL de sitio web inválida." }, { status: 400 });
    }
    domain = extractDomain(websiteUrl);
    if (!domain) {
      return NextResponse.json({ error: "URL de sitio web inválida." }, { status: 400 });
    }
  } else if (isNativeApp) {
    // Sin sitio: se usa el identificador de tienda como clave de dedup/anti-abuso,
    // namespaced para no colisionar nunca con un dominio real.
    domain = `app:${iosAppId || androidPackageId}`;
  } else {
    // Local/ecommerce sin sitio web: clave de dedup sintetica basada en el telefono
    // (unico dato de contacto siempre presente), namespaced igual que el caso de app.
    domain = `nosite:${normalizedPhone}`;
  }

  const ip = getClientIp(request);

  try {
    const rateLimit = await checkFreeAuditRateLimit(domain, normalizedPhone, ip);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: rateLimit.reason }, { status: 429 });
    }

    const admin = createAdminClient();
    const { data: freeAudit, error: freeAuditError } = await admin
      .from("free_audits")
      .insert({ domain, phone_whatsapp: normalizedPhone, ip_address: ip, whatsapp_verified: false })
      .select("id")
      .single();

    if (freeAuditError || !freeAudit) {
      return NextResponse.json({ error: "No se pudo registrar la solicitud." }, { status: 500 });
    }

    const result = await runFreeAudit({
      businessName: businessName.trim(),
      niche: niche.trim(),
      axis,
      city: city.trim(),
      country,
      websiteUrl: websiteUrl || undefined,
      phoneWhatsapp: normalizedPhone,
      email: typeof email === "string" && email.trim() ? email.trim() : undefined,
      publicListingOptIn: publicListingOptIn === true,
      iosAppId: iosAppId || undefined,
      androidPackageId: androidPackageId || undefined,
      appType: isApp ? (isNativeApp ? "native" : "web") : undefined,
    });

    // Enlaza la solicitud con el cliente que genero — es lo que impide que
    // /api/free-audit/report entregue el reporte de otro cliente (IDOR).
    await admin.from("free_audits").update({ client_id: result.clientId }).eq("id", freeAudit.id);

    return NextResponse.json({ freeAuditId: freeAudit.id, clientId: result.clientId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
