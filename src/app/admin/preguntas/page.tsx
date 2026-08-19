import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { RUBROS, QUESTION_BANK_COUNTRIES, TOTAL_COMBINATIONS } from "@/lib/question-bank/taxonomy";
import QuestionBankDetail from "./question-bank-detail";

// M28 — panel de admin del banco de preguntas nativas (43 rubros x 18 países = 774
// combinaciones acordadas con el fundador). Muestra cobertura real: cuántas
// combinaciones ya tienen contenido y cuáles siguen vacías — el hueco es la
// información útil para decidir qué llenar despues, no solo lo que ya existe.
export default async function AdminPreguntasPage({
  searchParams,
}: {
  searchParams: Promise<{ rubro?: string; country?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const admin = createAdminClient();

  const { data: allRows } = await admin.from("question_bank").select("rubro, country, active");

  const coverage = new Map<string, { total: number; active: number }>();
  for (const row of allRows ?? []) {
    const key = `${row.rubro}|${row.country}`;
    const entry = coverage.get(key) ?? { total: 0, active: 0 };
    entry.total += 1;
    if (row.active) entry.active += 1;
    coverage.set(key, entry);
  }

  const populatedCombos = Array.from(coverage.entries())
    .map(([key, counts]) => {
      const [rubro, country] = key.split("|");
      const rubroDef = RUBROS.find((r) => r.slug === rubro);
      return { rubro, country, label: rubroDef?.label ?? rubro, ...counts };
    })
    .sort((a, b) => b.total - a.total);

  const totalQuestions = (allRows ?? []).length;

  const selectedRubro = params.rubro ?? "";
  const selectedCountry = params.country ?? "";
  let selectedQuestions: Array<{ id: string; question_text: string; active: boolean }> = [];
  if (selectedRubro && selectedCountry) {
    const { data } = await admin
      .from("question_bank")
      .select("id, question_text, active")
      .eq("rubro", selectedRubro)
      .eq("country", selectedCountry)
      .order("created_at");
    selectedQuestions = data ?? [];
  }

  return (
    <main style={{ padding: 60, maxWidth: 1000, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">← Volver</Link>
      </p>
      <h1>Banco de preguntas</h1>
      <p>
        {populatedCombos.length} de {TOTAL_COMBINATIONS} combinaciones rubro+país tienen contenido · {totalQuestions}{" "}
        preguntas totales
      </p>

      <h2>Ver / agregar preguntas</h2>
      <form method="get" style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label>
          Rubro
          <br />
          <select name="rubro" defaultValue={selectedRubro}>
            <option value="">— Selecciona —</option>
            {RUBROS.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.label} {r.categoryType === "app" ? "(app)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          País
          <br />
          <select name="country" defaultValue={selectedCountry}>
            <option value="">— Selecciona —</option>
            {QUESTION_BANK_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Ver</button>
      </form>

      {selectedRubro && selectedCountry && (
        <QuestionBankDetail rubro={selectedRubro} country={selectedCountry} questions={selectedQuestions} />
      )}

      <h2 style={{ marginTop: 32 }}>Combinaciones con contenido ({populatedCombos.length})</h2>
      {populatedCombos.length === 0 ? (
        <p>Ninguna todavía.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", maxWidth: 700 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th>Rubro</th>
              <th>País</th>
              <th>Activas</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {populatedCombos.map((c) => (
              <tr key={`${c.rubro}-${c.country}`} style={{ borderBottom: "1px solid #eee" }}>
                <td>
                  <Link href={`/admin/preguntas?rubro=${c.rubro}&country=${c.country}`}>{c.label}</Link>
                </td>
                <td>{c.country}</td>
                <td>{c.active}</td>
                <td>{c.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
