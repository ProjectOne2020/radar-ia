import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addCompetitor } from "@/lib/dashboard/add-competitor";
import { consumeRateLimit, tooManyRequests } from "@/lib/security/rate-limit";

async function getSessionClientId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (user?.app_metadata?.client_id as string | undefined) ?? null;
}

export const maxDuration = 60;

export async function POST(request: Request) {
  const clientId = await getSessionClientId();
  if (!clientId) return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { competitorName, city, websiteUrl } = body ?? {};

  if (!competitorName || typeof competitorName !== "string" || competitorName.trim().length < 2) {
    return NextResponse.json({ error: "Nombre del competidor inválido." }, { status: 400 });
  }
  if (!city || typeof city !== "string") {
    return NextResponse.json({ error: "Ciudad requerida." }, { status: 400 });
  }
  if (!websiteUrl || typeof websiteUrl !== "string") {
    return NextResponse.json({ error: "Sitio web requerido." }, { status: 400 });
  }
  if (competitorName.length > 120 || city.length > 120 || websiteUrl.length > 500) {
    return NextResponse.json({ error: "Alguno de los campos excede el largo permitido." }, { status: 400 });
  }

  // Este es el endpoint mas caro del producto: cada alta corre las preguntas activas
  // del dueño contra los 4 motores de IA reales + auditoria tecnica + score. Antes
  // bastaba con estar logueado — sin suscripcion activa y sin tope de frecuencia.
  const admin = createAdminClient();
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("status")
    .eq("client_id", clientId)
    .maybeSingle();

  if (subscription?.status !== "active") {
    return NextResponse.json(
      { error: "Necesitas una suscripción activa para comparar competidores." },
      { status: 403 },
    );
  }

  const addLimit = await consumeRateLimit({
    bucket: "competitor_add_client",
    identifier: clientId,
    limit: 10,
    windowSeconds: 24 * 60 * 60,
  });
  if (!addLimit.allowed) {
    return tooManyRequests(
      "Alcanzaste el límite de competidores nuevos por hoy. Intenta mañana.",
      addLimit.retryAfterSeconds,
    );
  }

  try {
    const result = await addCompetitor({ ownerClientId: clientId, competitorName, city, websiteUrl });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// La lectura de datos de OTRO client_id (el competidor) nunca pasa RLS del dueño — por
// diseño, RLS solo deja ver la propia fila. Este endpoint valida la relacion de propiedad
// via client_competitors (RLS, solo filas propias) y LUEGO usa admin para leer los datos
// del competidor — la autorizacion ya se verifico, no es un bypass ciego de RLS.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });

  const [{ data: links, error: linksError }, { data: myScores }] = await Promise.all([
    supabase.from("client_competitors").select("id, competitor_client_id, created_at"),
    supabase
      .from("ai_visibility_scores")
      .select("score_total")
      .order("calculated_at", { ascending: false })
      .limit(1),
  ]);
  const myScore = myScores?.[0]?.score_total ?? null;

  if (linksError) return NextResponse.json({ error: linksError.message }, { status: 500 });
  if (!links || links.length === 0) return NextResponse.json({ competitors: [], myScore });

  const admin = createAdminClient();
  const competitorIds = links.map((l) => l.competitor_client_id).filter((id): id is string => Boolean(id));

  const [{ data: competitorClients }, { data: scores }] = await Promise.all([
    admin.from("clients").select("id, business_name").in("id", competitorIds),
    admin
      .from("ai_visibility_scores")
      .select("client_id, score_total, calculated_at")
      .in("client_id", competitorIds)
      .order("calculated_at", { ascending: false }),
  ]);

  const latestScoreByClient = new Map<string, { score_total: number; calculated_at: string | null }>();
  for (const score of scores ?? []) {
    if (!score.client_id || latestScoreByClient.has(score.client_id)) continue;
    latestScoreByClient.set(score.client_id, { score_total: score.score_total, calculated_at: score.calculated_at });
  }

  const competitors = links.map((link) => {
    const client = (competitorClients ?? []).find((c) => c.id === link.competitor_client_id);
    const score = link.competitor_client_id ? latestScoreByClient.get(link.competitor_client_id) : undefined;
    return {
      linkId: link.id,
      competitorClientId: link.competitor_client_id,
      businessName: client?.business_name ?? "(sin datos)",
      scoreTotal: score?.score_total ?? null,
      calculatedAt: score?.calculated_at ?? null,
    };
  });

  return NextResponse.json({ competitors, myScore });
}
