import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { RUBROS, QUESTION_BANK_COUNTRIES, TOTAL_COMBINATIONS } from "@/lib/question-bank/taxonomy";
import { AdminShell } from "@/components/admin/admin-shell";
import { Label, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
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
    <AdminShell title="Banco de preguntas">
      <p className="mb-6 text-sm text-text-secondary">
        {populatedCombos.length} de {TOTAL_COMBINATIONS} combinaciones rubro+país tienen contenido ·{" "}
        {totalQuestions} preguntas totales
      </p>

      <h2 className="mb-3 font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
        Ver / agregar preguntas
      </h2>
      <form method="get" className="flex flex-wrap items-end gap-4">
        <div>
          <Label htmlFor="rubro">Rubro</Label>
          <Select id="rubro" name="rubro" defaultValue={selectedRubro} className="w-64">
            <option value="">— Selecciona —</option>
            {RUBROS.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.label} {r.categoryType === "app" ? "(app)" : ""}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="country">País</Label>
          <Select id="country" name="country" defaultValue={selectedCountry} className="w-48">
            <option value="">— Selecciona —</option>
            {QUESTION_BANK_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" size="sm">
          Ver
        </Button>
      </form>

      {selectedRubro && selectedCountry && (
        <QuestionBankDetail rubro={selectedRubro} country={selectedCountry} questions={selectedQuestions} />
      )}

      <h2 className="mt-10 mb-3 font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
        Combinaciones con contenido ({populatedCombos.length})
      </h2>
      {populatedCombos.length === 0 ? (
        <p className="text-sm text-text-muted">Ninguna todavía.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[500px] max-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-strong bg-paper-raised text-left text-xs tracking-wide text-text-secondary uppercase">
                <th className="px-4 py-3 font-medium">Rubro</th>
                <th className="px-4 py-3 font-medium">País</th>
                <th className="px-4 py-3 font-medium">Activas</th>
                <th className="px-4 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {populatedCombos.map((c) => (
                <tr key={`${c.rubro}-${c.country}`} className="border-b border-border last:border-b-0 hover:bg-surface">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/preguntas?rubro=${c.rubro}&country=${c.country}`}
                      className="text-ink hover:text-signal-strong"
                    >
                      {c.label}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">{c.country}</td>
                  <td className="px-4 py-2.5 font-mono text-ink">{c.active}</td>
                  <td className="px-4 py-2.5 font-mono text-text-secondary">{c.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
