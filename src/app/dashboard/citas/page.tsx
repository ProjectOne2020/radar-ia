import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// M7 — lista de citations con distincion dominio propio vs. directorio. La policy
// citations_select_own de M1 ya filtra por tracking_runs.client_id, no hace falta filtro
// adicional aqui.
export default async function CitasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: runs } = await supabase
    .from("tracking_runs")
    .select("id, engine, mentioned, run_at, citations(cited_url, cited_domain, is_client_domain, is_directory)")
    .order("run_at", { ascending: false });

  return (
    <main style={{ padding: 60, maxWidth: 720, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/dashboard">← Volver</Link>
      </p>
      <h1>Citas por motor</h1>

      {(runs ?? []).map((run) => (
        <section key={run.id} style={{ marginTop: 16, borderTop: "1px solid #ddd", paddingTop: 8 }}>
          <p>
            <strong>{run.engine}</strong> · {run.mentioned ? "✅ mencionado" : "❌ no mencionado"} ·{" "}
            {run.run_at ? new Date(run.run_at).toLocaleString() : ""}
          </p>
          {run.citations && run.citations.length > 0 ? (
            <ul>
              {run.citations.map((c, i) => (
                <li key={i}>
                  {c.cited_domain}{" "}
                  {c.is_client_domain && <span style={{ color: "green" }}>(tu sitio)</span>}
                  {c.is_directory && <span style={{ color: "#3c78d8" }}>(directorio)</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: "#666" }}>Sin citas en esta corrida.</p>
          )}
        </section>
      ))}

      {(!runs || runs.length === 0) && <p>Todavía no hay corridas de medición.</p>}
    </main>
  );
}
