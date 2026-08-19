import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui/container";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Select, Label } from "@/components/ui/field";
import { ButtonLink } from "@/components/ui/button";

interface ListingRow {
  id: string;
  businessName: string;
  niche: string;
  city: string | null;
  country: string;
  score: number;
  trend: "up" | "down" | "flat" | "new";
  measuredAt: string;
}

// M27 — listado publico (05-MARKETING-DISTRIBUCION.md seccion 2.3), pedido
// explicitamente por el fundador. SOLO incluye negocios con
// clients.public_listing_opt_in = true (opt-in explicito, ver run-free-audit.ts y
// /api/dashboard/public-listing) — pedir la auditoria NO es suficiente por si solo,
// decision confirmada con el fundador porque el texto original del documento conflaba
// ambas cosas y el propio documento marca esto como un riesgo legal/reputacional.
// Se usa el cliente admin (service_role) porque no existe ninguna policy de SELECT
// publica sobre `clients` — el filtro por opt-in vive aqui, en el codigo, nunca se
// expone la tabla completa. Solo se muestra el score total (nunca hallazgos ni datos
// de contacto), tal como pide el documento ("cuidado de no exponer el detalle
// accionable, solo el score").
async function fetchListingRows(): Promise<ListingRow[]> {
  const admin = createAdminClient();

  const { data: clients } = await admin
    .from("clients")
    .select("id, business_name, niche, country")
    .eq("public_listing_opt_in", true);

  if (!clients || clients.length === 0) return [];

  const clientIds = clients.map((c) => c.id);

  const [{ data: locations }, { data: scores }] = await Promise.all([
    admin.from("locations").select("client_id, city").in("client_id", clientIds),
    admin
      .from("ai_visibility_scores")
      .select("client_id, score_total, calculated_at")
      .in("client_id", clientIds)
      .order("calculated_at", { ascending: false }),
  ]);

  const cityByClient = new Map<string, string>();
  for (const loc of locations ?? []) {
    if (loc.client_id && loc.city && !cityByClient.has(loc.client_id)) {
      cityByClient.set(loc.client_id, loc.city);
    }
  }

  const scoresByClient = new Map<string, Array<{ score_total: number; calculated_at: string | null }>>();
  for (const s of scores ?? []) {
    if (!s.client_id) continue;
    const list = scoresByClient.get(s.client_id) ?? [];
    list.push(s);
    scoresByClient.set(s.client_id, list);
  }

  const rows: ListingRow[] = [];
  for (const c of clients) {
    const history = scoresByClient.get(c.id);
    if (!history || history.length === 0) continue; // opt-in pero todavia sin medicion

    const [latest, previous] = history;
    let trend: ListingRow["trend"] = "new";
    if (previous) {
      trend = latest.score_total > previous.score_total ? "up" : latest.score_total < previous.score_total ? "down" : "flat";
    }

    rows.push({
      id: c.id,
      businessName: c.business_name,
      niche: c.niche,
      city: cityByClient.get(c.id) ?? null,
      country: c.country,
      score: Math.round(latest.score_total),
      trend,
      measuredAt: latest.calculated_at ?? "",
    });
  }

  return rows.sort((a, b) => b.score - a.score);
}

export default async function ListadoPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; niche?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("Listado");
  const allRows = await fetchListingRows();

  const cities = Array.from(new Set(allRows.map((r) => r.city).filter((c): c is string => !!c))).sort();
  const niches = Array.from(new Set(allRows.map((r) => r.niche))).sort();

  const cityFilter = params.city ?? "";
  const nicheFilter = params.niche ?? "";
  const rows = allRows.filter(
    (r) => (!cityFilter || r.city === cityFilter) && (!nicheFilter || r.niche === nicheFilter),
  );

  return (
    <>
      <SiteHeader />
      <main>
        <Container narrow className="py-10 sm:py-16">
          <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>
          <p className="mt-3 max-w-[64ch] text-text-secondary">{t("hook")}</p>
          <p className="mt-2 max-w-[64ch] text-sm text-text-muted">{t("consentNote")}</p>

          {allRows.length > 0 && (
            <form method="get" className="mt-8 flex flex-wrap items-end gap-4">
              <div>
                <Label htmlFor="city">{t("filterCity")}</Label>
                <Select id="city" name="city" defaultValue={cityFilter}>
                  <option value="">{t("filterAll")}</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="niche">{t("filterNiche")}</Label>
                <Select id="niche" name="niche" defaultValue={nicheFilter}>
                  <option value="">{t("filterAll")}</option>
                  {niches.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </div>
              <button
                type="submit"
                className="rounded-xs border border-border-strong bg-transparent px-3.5 py-2.5 text-sm text-text transition-colors hover:border-signal hover:bg-surface"
              >
                {t("filterApply")}
              </button>
            </form>
          )}

          <div className="mt-8">
            {rows.length === 0 ? (
              <Panel raised>
                <p className="text-text-secondary">{allRows.length === 0 ? t("emptyGlobal") : t("emptyFiltered")}</p>
                <ButtonLink href="/auditoria-gratis" className="mt-5 inline-flex">
                  {t("ctaAudit")}
                </ButtonLink>
              </Panel>
            ) : (
              <Panel className="divide-y divide-border p-0">
                {rows.map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{row.businessName}</p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {row.niche}
                        {row.city ? ` · ${row.city}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <TrendBadge trend={row.trend} labels={t} />
                      <span className="font-mono text-lg font-semibold text-ink">{row.score}</span>
                    </div>
                  </div>
                ))}
              </Panel>
            )}
          </div>

          <Panel className="mt-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold text-ink">{t("notListedTitle")}</h2>
              <p className="mt-1.5 max-w-[52ch] text-sm text-text-secondary">{t("notListedBody")}</p>
            </div>
            <ButtonLink href="/auditoria-gratis" variant="secondary" className="shrink-0">
              {t("ctaAudit")}
            </ButtonLink>
          </Panel>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}

function TrendBadge({
  trend,
  labels,
}: {
  trend: ListingRow["trend"];
  labels: Awaited<ReturnType<typeof getTranslations>>;
}) {
  if (trend === "up") return <Badge tone="good">▲ {labels("trendUp")}</Badge>;
  if (trend === "down") return <Badge tone="critical">▼ {labels("trendDown")}</Badge>;
  if (trend === "flat") return <Badge tone="neutral">– {labels("trendFlat")}</Badge>;
  return <Badge tone="observed">{labels("trendNew")}</Badge>;
}
