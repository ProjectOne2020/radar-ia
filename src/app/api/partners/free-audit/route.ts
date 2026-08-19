import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkFreeAuditRateLimit, getClientIp } from "@/lib/free-audit/rate-limit";
import { runFreeAudit, type AuditAxis } from "@/lib/free-audit/run-free-audit";
import { extractDomain } from "@/lib/ai-engines/classify-domain";
import { authenticatePartner } from "@/lib/partners/authenticate";

const VALID_AXES: AuditAxis[] = ["local", "ecommerce", "app"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// M13, primer corte (decidido explicitamente con el fundador): el canal de partner
// solo corre auditorias gratis atribuidas al partner — replica el flujo publico de M6
// con la misma logica de anti-abuso, no da de alta clientes de pago via API todavia.
// M23 — mismo eje explicito (axis/appType) que el endpoint publico, en vez de inferirlo
// del string de niche.
export const maxDuration = 60;

export async function POST(request: Request) {
  const partner = await authenticatePartner(request);
  if (!partner) {
    return NextResponse.json({ error: "API key invalida o inactiva." }, { status: 401 });
  }

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
  if (!niche || typeof niche !== "string" || niche.trim().length < 2 || niche.length > 120) {
    return NextResponse.json({ error: "Rubro requerido." }, { status: 400 });
  }
  if (!VALID_AXES.includes(axis)) {
    return NextResponse.json({ error: "axis debe ser 'local', 'ecommerce' o 'app'." }, { status: 400 });
  }
  if (!city || typeof city !== "string" || city.trim().length < 2) {
    return NextResponse.json({ error: "Ciudad requerida." }, { status: 400 });
  }
  if (!country || typeof country !== "string") {
    return NextResponse.json({ error: "País requerido." }, { status: 400 });
  }
  if (!phoneWhatsapp || !/^\+\d{8,15}$/.test(phoneWhatsapp)) {
    return NextResponse.json({ error: "Teléfono de WhatsApp inválido (usa formato +52...)." }, { status: 400 });
  }
  if (email !== undefined && email !== null && (typeof email !== "string" || (email && !EMAIL_RE.test(email)))) {
    return NextResponse.json({ error: "Correo inválido." }, { status: 400 });
  }
  if (publicListingOptIn !== undefined && typeof publicListingOptIn !== "boolean") {
    return NextResponse.json({ error: "publicListingOptIn debe ser true o false." }, { status: 400 });
  }

  const isApp = axis === "app";
  const isNativeApp = isApp && appType === "native";

  if (isNativeApp) {
    if ((!iosAppId || typeof iosAppId !== "string") && (!androidPackageId || typeof androidPackageId !== "string")) {
      return NextResponse.json(
        { error: "Indica al menos el ID de App Store o el package de Google Play." },
        { status: 400 }
      );
    }
  } else if (!websiteUrl || typeof websiteUrl !== "string") {
    return NextResponse.json({ error: "Sitio web requerido." }, { status: 400 });
  }

  let domain: string | null = null;
  if (websiteUrl) {
    domain = extractDomain(websiteUrl);
    if (!domain) {
      return NextResponse.json({ error: "URL de sitio web inválida." }, { status: 400 });
    }
  } else if (isNativeApp) {
    domain = `app:${iosAppId || androidPackageId}`;
  }

  if (!domain) {
    return NextResponse.json({ error: "URL de sitio web inválida." }, { status: 400 });
  }

  const ip = getClientIp(request);

  try {
    const rateLimit = await checkFreeAuditRateLimit(domain, phoneWhatsapp, ip);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: rateLimit.reason }, { status: 429 });
    }

    const admin = createAdminClient();
    const { data: freeAudit, error: freeAuditError } = await admin
      .from("free_audits")
      .insert({ domain, phone_whatsapp: phoneWhatsapp, ip_address: ip, whatsapp_verified: false })
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
      phoneWhatsapp,
      email: email || undefined,
      publicListingOptIn: publicListingOptIn === true,
      partnerId: partner.id,
      iosAppId: iosAppId || undefined,
      androidPackageId: androidPackageId || undefined,
    });

    // Mismo enlace que el endpoint publico — sin esto, /api/free-audit/report
    // no puede validar que el reporte pedido corresponde a esta solicitud.
    await admin.from("free_audits").update({ client_id: result.clientId }).eq("id", freeAudit.id);

    return NextResponse.json({
      freeAuditId: freeAudit.id,
      clientId: result.clientId,
      scoreTotal: result.scoreTotal,
      partner: partner.agencyName,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
