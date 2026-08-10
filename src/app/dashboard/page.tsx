import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const PILLAR_NAMES: Record<string, string> = {
  "1": "Identidad/consistencia (NAP)",
  "2": "Google Business Profile",
  "3": "Crawlability + schema técnico",
  "4": "Estructura semántica",
  "5": "Cobertura de preguntas",
  "6": "Citas y autoridad externa",
  "7": "Reputación (reseñas)",
  "8": "Medición directa en motores de IA",
};

// M7 — todo lo que se lee aqui usa el cliente server (RLS), no admin: si esta pagina
// muestra datos, es la prueba viva de que la sesion quedo enlazada a client_id (M1 + M5).
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: client }, { data: scoreHistory }] = await Promise.all([
    supabase.from("clients").select("business_name, niche, plan, verification_status").single(),
    supabase
      .from("ai_visibility_scores")
      .select("id, score_total, score_by_pillar, calculated_at")
      .order("calculated_at", { ascending: false }),
  ]);

  const latest = scoreHistory?.[0];

  return (
    <main style={{ padding: 60, maxWidth: 720, fontFamily: "sans-serif" }}>
      <h1>{client?.business_name ?? "Tu negocio"}</h1>
      <p>
        Plan: {client?.plan} · Rubro: {client?.niche} · Verificación: {client?.verification_status}
      </p>

      <nav style={{ display: "flex", gap: 16, margin: "16px 0" }}>
        <Link href="/dashboard/hallazgos">Hallazgos completos</Link>
        <Link href="/dashboard/citas">Citas</Link>
        <Link href="/dashboard/competidores">Competidores</Link>
      </nav>

      {!scoreHistory || scoreHistory.length === 0 ? (
        <p>Todavía no hay un score calculado para este negocio.</p>
      ) : (
        <>
          <h2>Score actual: {Math.round(latest!.score_total)}/100</h2>

          <h3>Desglose por pilar</h3>
          <ul>
            {Object.entries((latest!.score_by_pillar as Record<string, { subscore: number; measured: boolean }>) ?? {}).map(
              ([pillar, info]) => (
                <li key={pillar}>
                  {PILLAR_NAMES[pillar] ?? `Pilar ${pillar}`}:{" "}
                  {info.measured ? `${Math.round(info.subscore)}/100` : "sin datos suficientes"}
                </li>
              )
            )}
          </ul>

          <h3>Histórico ({scoreHistory.length} cálculo{scoreHistory.length === 1 ? "" : "s"})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {scoreHistory.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 160, fontSize: 12, color: "#666" }}>
                  {s.calculated_at ? new Date(s.calculated_at).toLocaleString() : "—"}
                </span>
                <div style={{ background: "#eee", width: 200, height: 12 }}>
                  <div style={{ background: "#3c78d8", width: `${s.score_total}%`, height: 12 }} />
                </div>
                <span>{Math.round(s.score_total)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
