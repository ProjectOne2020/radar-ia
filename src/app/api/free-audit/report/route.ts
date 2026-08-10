import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// El gate real de "no mostrar el reporte sin verificar" vive AQUI (server-side), no solo en
// el orden de las pantallas del frontend — cualquiera que llame este endpoint directo debe
// chocar con el mismo chequeo. Solo expone audit_findings con detail_locked=false y el score
// general (01-CONTEXTO-NEGOCIO.md seccion 8: "nunca el detalle accionable exacto").
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const freeAuditId = searchParams.get("freeAuditId");
  const clientId = searchParams.get("clientId");

  if (!freeAuditId || !clientId) {
    return NextResponse.json({ error: "freeAuditId y clientId son requeridos." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: freeAudit, error: freeAuditError } = await admin
    .from("free_audits")
    .select("whatsapp_verified")
    .eq("id", freeAuditId)
    .single();

  if (freeAuditError || !freeAudit) {
    return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 });
  }
  if (!freeAudit.whatsapp_verified) {
    return NextResponse.json({ error: "Verifica tu WhatsApp antes de ver el reporte." }, { status: 403 });
  }

  const [{ data: client }, { data: score }, { data: findings }] = await Promise.all([
    admin.from("clients").select("business_name, niche").eq("id", clientId).single(),
    admin
      .from("ai_visibility_scores")
      .select("score_total, score_by_pillar, calculated_at")
      .eq("client_id", clientId)
      .order("calculated_at", { ascending: false })
      .limit(1)
      .single(),
    admin
      .from("audit_findings")
      .select("pillar, finding, severity")
      .eq("client_id", clientId)
      .eq("detail_locked", false)
      .order("pillar", { ascending: true }),
  ]);

  if (!score) {
    return NextResponse.json({ error: "El score todavía no está listo." }, { status: 404 });
  }

  return NextResponse.json({
    businessName: client?.business_name,
    niche: client?.niche,
    scoreTotal: score.score_total,
    scoreByPillar: score.score_by_pillar,
    findings: findings ?? [],
  });
}
