import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addCompetitor } from "@/lib/dashboard/add-competitor";

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

  const { data: links, error: linksError } = await supabase
    .from("client_competitors")
    .select("id, competitor_client_id, created_at");

  if (linksError) return NextResponse.json({ error: linksError.message }, { status: 500 });
  if (!links || links.length === 0) return NextResponse.json({ competitors: [] });

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

  return NextResponse.json({ competitors });
}
