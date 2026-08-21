import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin/is-admin";
import { runFreeAudit, type AuditAxis } from "@/lib/free-audit/run-free-audit";
import { extractDomain } from "@/lib/ai-engines/classify-domain";

const VALID_AXES: AuditAxis[] = ["local", "ecommerce", "app"];

// Pedido explicito del fundador: poder correr una auditoria completa real sobre CUALQUIER
// negocio desde /admin, sin que ese negocio se haya registrado ni pasado por el OTP
// publico de /auditoria-gratis (a diferencia de esa ruta, aqui no hay rate-limit ni fila en
// free_audits -- es una herramienta interna, no un funnel publico). Reusa runFreeAudit()
// tal cual (mismo motor real: M2+M3+M4), la unica diferencia es quien la dispara y que no
// exige telefono/correo verificados. onboarding_type se marca "admin" despues de crear el
// cliente para distinguir estas fichas de un alta real de cliente/prospecto.
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
    iosAppId,
    androidPackageId,
  } = body ?? {};

  if (!businessName || typeof businessName !== "string" || businessName.trim().length < 2) {
    return NextResponse.json({ error: "Nombre del negocio inválido." }, { status: 400 });
  }
  if (!niche || typeof niche !== "string" || niche.trim().length < 2 || niche.length > 120) {
    return NextResponse.json({ error: "Indica el rubro del negocio." }, { status: 400 });
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

  const isApp = axis === "app";
  const isNativeApp = isApp && appType === "native";

  if (isNativeApp) {
    if ((!iosAppId || typeof iosAppId !== "string") && (!androidPackageId || typeof androidPackageId !== "string")) {
      return NextResponse.json(
        { error: "Indica al menos el ID de App Store o el package de Google Play." },
        { status: 400 },
      );
    }
  } else if (!websiteUrl || typeof websiteUrl !== "string") {
    return NextResponse.json({ error: "Sitio web requerido." }, { status: 400 });
  }

  if (websiteUrl && !extractDomain(websiteUrl)) {
    return NextResponse.json({ error: "URL de sitio web inválida." }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    const result = await runFreeAudit({
      businessName: businessName.trim(),
      niche: niche.trim(),
      axis,
      city: city.trim(),
      country,
      websiteUrl: websiteUrl || undefined,
      // No hay verificacion de WhatsApp/correo aqui (a diferencia de /auditoria-gratis) —
      // clients.phone_whatsapp es NOT NULL, se deja un valor explicito de "sin dato" si el
      // admin no lo llena.
      phoneWhatsapp: (typeof phoneWhatsapp === "string" && phoneWhatsapp.trim()) || "N/A",
      email: typeof email === "string" && email.trim() ? email.trim() : undefined,
      publicListingOptIn: false,
      iosAppId: iosAppId || undefined,
      androidPackageId: androidPackageId || undefined,
      appType: isApp ? (isNativeApp ? "native" : "web") : undefined,
    });

    await admin.from("clients").update({ onboarding_type: "admin" }).eq("id", result.clientId);

    return NextResponse.json({ clientId: result.clientId, scoreTotal: result.scoreTotal });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
