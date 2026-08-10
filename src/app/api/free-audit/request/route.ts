import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkFreeAuditRateLimit, getClientIp } from "@/lib/free-audit/rate-limit";
import { runFreeAudit } from "@/lib/free-audit/run-free-audit";
import { extractDomain } from "@/lib/ai-engines/classify-domain";

// Corre M2 ligero (llamadas reales a OpenAI/Anthropic/Gemini/Perplexity) + M3 + M4 de forma
// sincrona — puede tardar. En Vercel Hobby el limite por defecto de una function es corto;
// hay que confirmar el plan/limite real antes de lanzar a producción (ver resumen al fundador).
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { businessName, niche, city, country, websiteUrl, phoneWhatsapp } = body ?? {};

  if (!businessName || typeof businessName !== "string" || businessName.trim().length < 2) {
    return NextResponse.json({ error: "Nombre del negocio inválido." }, { status: 400 });
  }
  if (!niche || typeof niche !== "string") {
    return NextResponse.json({ error: "Rubro requerido." }, { status: 400 });
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

  const domain = extractDomain(websiteUrl ?? "");
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
      niche,
      city: city.trim(),
      country,
      websiteUrl,
      phoneWhatsapp,
    });

    return NextResponse.json({ freeAuditId: freeAudit.id, clientId: result.clientId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
