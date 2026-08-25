import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findingsQueryForSnapshot, loadCurrentSnapshot } from "@/lib/measurement/current-snapshot";

// El gate real de "no mostrar el reporte sin verificar" vive AQUI (server-side), no solo en
// el orden de las pantallas del frontend — cualquiera que llame este endpoint directo debe
// chocar con el mismo chequeo. Solo expone audit_findings con detail_locked=false y el score
// general (01-CONTEXTO-NEGOCIO.md seccion 8: "nunca el detalle accionable exacto").
//
// IDOR corregido: antes se validaba que el freeAuditId estuviera verificado, pero NO que
// ese freeAuditId correspondiera al clientId pedido — los dos venian sueltos en la query
// string. Cualquiera con una auditoria gratis propia verificada podia iterar clientIds
// ajenos y leer el nombre, rubro, score y hallazgos de cualquier cliente, incluidos los
// de pago. Ahora free_audits.client_id es la fuente de verdad y el clientId del query
// string debe coincidir.
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
    .select("whatsapp_verified, client_id")
    .eq("id", freeAuditId)
    .single();

  if (freeAuditError || !freeAudit) {
    return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 });
  }
  if (!freeAudit.whatsapp_verified) {
    return NextResponse.json({ error: "Verifica tu WhatsApp antes de ver el reporte." }, { status: 403 });
  }
  // El reporte solo se entrega para el cliente que esta auditoria genero.
  if (!freeAudit.client_id || freeAudit.client_id !== clientId) {
    return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 });
  }

  // P0.2-B — el reporte gratis describe la sesion que produjo el score, no el acumulado del
  // cliente interno.
  const [{ data: client }, snapshot] = await Promise.all([
    admin.from("clients").select("business_name, niche").eq("id", clientId).single(),
    loadCurrentSnapshot(admin, clientId),
  ]);

  if (!snapshot) {
    return NextResponse.json({ error: "El score todavía no está listo." }, { status: 404 });
  }

  const { data: findings } = await findingsQueryForSnapshot(admin, snapshot, clientId)
    .eq("detail_locked", false)
    .order("pillar", { ascending: true });

  const score = {
    score_total: snapshot.scoreTotal,
    score_by_pillar: snapshot.scoreByPillar,
    calculated_at: snapshot.calculatedAt,
  };

  return NextResponse.json({
    businessName: client?.business_name,
    niche: client?.niche,
    scoreTotal: score.score_total,
    scoreByPillar: score.score_by_pillar,
    findings: findings ?? [],
  });
}
