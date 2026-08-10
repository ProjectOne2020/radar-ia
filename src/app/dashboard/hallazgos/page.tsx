import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const PILLAR_NAMES: Record<number, string> = {
  1: "Identidad/consistencia (NAP)",
  2: "Google Business Profile",
  3: "Crawlability + schema técnico",
  4: "Estructura semántica",
  5: "Cobertura de preguntas",
  6: "Citas y autoridad externa",
  7: "Reputación (reseñas)",
  8: "Medición directa en motores de IA",
};

// M7 — a diferencia de M6 (auditoria gratis), aqui NO se filtra por detail_locked. La
// policy audit_findings_select_own de M1 ya devuelve todo lo del propio cliente, incluido
// el detalle accionable — es exactamente lo que un cliente pagado debe ver.
export default async function HallazgosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: findings } = await supabase
    .from("audit_findings")
    .select("pillar, finding, severity, detail_locked, audited_at")
    .order("pillar", { ascending: true });

  const byPillar = new Map<number, typeof findings>();
  for (const f of findings ?? []) {
    if (!byPillar.has(f.pillar)) byPillar.set(f.pillar, []);
    byPillar.get(f.pillar)!.push(f);
  }

  return (
    <main style={{ padding: 60, maxWidth: 720, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/dashboard">← Volver</Link>
      </p>
      <h1>Hallazgos completos</h1>
      <p>Incluye el detalle accionable — esto es lo que la auditoría gratis nunca muestra.</p>

      {[...byPillar.entries()].map(([pillar, list]) => (
        <section key={pillar} style={{ marginTop: 24 }}>
          <h2>{PILLAR_NAMES[pillar] ?? `Pilar ${pillar}`}</h2>
          <ul>
            {list!.map((f, i) => (
              <li key={i} style={{ color: f.severity === "critical" ? "crimson" : f.severity === "warning" ? "#b58900" : "inherit" }}>
                [{f.severity}] {f.finding}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {(!findings || findings.length === 0) && <p>Todavía no hay hallazgos — corre una auditoría primero.</p>}
    </main>
  );
}
