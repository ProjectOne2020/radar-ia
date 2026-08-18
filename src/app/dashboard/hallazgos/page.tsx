import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

const PILLAR_KEYS: Record<number, string> = {
  1: "1",
  2: "2_local",
  3: "3",
  4: "4_local",
  5: "5",
  6: "6",
  7: "7_local",
  8: "8",
};

// M7 — a diferencia de M6 (auditoria gratis), aqui NO se filtra por detail_locked. La
// policy audit_findings_select_own de M1 ya devuelve todo lo del propio cliente, incluido
// el detalle accionable — es exactamente lo que un cliente pagado debe ver.
export default async function HallazgosPage() {
  const t = await getTranslations("DashboardHallazgos");
  const tPillars = await getTranslations("Pillars");
  const tCommon = await getTranslations("Common");
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
        <Link href="/dashboard">{tCommon("back")}</Link>
      </p>
      <h1>{t("title")}</h1>
      <p>{t("subtitle")}</p>

      {[...byPillar.entries()].map(([pillar, list]) => (
        <section key={pillar} style={{ marginTop: 24 }}>
          <h2>{tPillars(PILLAR_KEYS[pillar] ?? "fallback", { n: pillar })}</h2>
          <ul>
            {list!.map((f, i) => (
              <li key={i} style={{ color: f.severity === "critical" ? "crimson" : f.severity === "warning" ? "#b58900" : "inherit" }}>
                [{f.severity}] {f.finding}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {(!findings || findings.length === 0) && <p>{t("empty")}</p>}
    </main>
  );
}
