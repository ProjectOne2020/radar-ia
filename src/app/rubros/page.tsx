import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RUBROS } from "@/lib/question-bank/taxonomy";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui/container";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

// Contenido casi estatico (la taxonomia de rubros vive en codigo, las preguntas de
// ejemplo cambian poco) — revalidamos cada hora en vez de pegarle a Supabase en cada
// request de esta pagina de marketing.
export const revalidate = 3600;

// Pais de referencia para las preguntas de ejemplo: MX es el unico con los 43 rubros
// completamente cargados desde el arranque del banco (ver BANCO-PREGUNTAS-PROGRESO.md),
// asi que sirve como muestra representativa mientras el resto de paises se termina de
// cargar. Son preguntas REALES del banco, no inventadas para esta pagina.
const EXAMPLES_COUNTRY = "MX";
const EXAMPLES_PER_RUBRO = 2;

async function fetchExamplesByRubro(): Promise<Map<string, string[]>> {
  const admin = createAdminClient();

  const results = await Promise.all(
    RUBROS.map(async (rubro) => {
      const { data } = await admin
        .from("question_bank")
        .select("question_text")
        .eq("country", EXAMPLES_COUNTRY)
        .eq("rubro", rubro.slug)
        .eq("active", true)
        .order("id", { ascending: true })
        .limit(EXAMPLES_PER_RUBRO);
      return [
        rubro.slug,
        (data ?? []).map((r) => r.question_text.replace(/\{city\}/g, "tu ciudad")),
      ] as const;
    }),
  );

  return new Map(results);
}

export default async function RubrosPage() {
  const t = await getTranslations("Rubros");
  const examplesByRubro = await fetchExamplesByRubro();

  const verticales = RUBROS.filter((r) => r.categoryType === "vertical");
  const apps = RUBROS.filter((r) => r.categoryType === "app");

  return (
    <>
      <SiteHeader />
      <main>
        <Container narrow className="py-10 sm:py-16">
          <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>
          <p className="mt-3 max-w-[64ch] text-text-secondary">{t("subtitle")}</p>
          <p className="mt-2 max-w-[64ch] text-sm text-text-muted">{t("examplesNote", { country: t("exampleCountryLabel") })}</p>

          <RubroGroup
            title={t("verticalGroupTitle")}
            body={t("verticalGroupBody")}
            rubros={verticales}
            examplesByRubro={examplesByRubro}
            noExamples={t("noExamples")}
            rubroLabel={t}
          />

          <RubroGroup
            title={t("appGroupTitle")}
            body={t("appGroupBody")}
            rubros={apps}
            examplesByRubro={examplesByRubro}
            noExamples={t("noExamples")}
            rubroLabel={t}
            className="mt-14"
          />

          <Panel className="mt-14 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-semibold text-ink">{t("ctaTitle")}</h2>
              <p className="mt-1.5 max-w-[52ch] text-sm text-text-secondary">{t("ctaBody")}</p>
            </div>
            <ButtonLink href="/auditoria-gratis" className="shrink-0">
              {t("ctaButton")}
            </ButtonLink>
          </Panel>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}

function RubroGroup({
  title,
  body,
  rubros,
  examplesByRubro,
  noExamples,
  rubroLabel,
  className,
}: {
  title: string;
  body: string;
  rubros: typeof RUBROS;
  examplesByRubro: Map<string, string[]>;
  noExamples: string;
  rubroLabel: Awaited<ReturnType<typeof getTranslations>>;
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-1.5 max-w-[60ch] text-sm text-text-secondary">{body}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {rubros.map((rubro) => {
          const examples = examplesByRubro.get(rubro.slug) ?? [];
          return (
            <Panel key={rubro.slug} className="flex flex-col gap-3">
              <Badge tone="neutral">{rubroLabel(rubro.slug)}</Badge>
              {examples.length > 0 ? (
                <ul className="space-y-1.5">
                  {examples.map((q, i) => (
                    <li key={i} className="text-sm leading-relaxed text-text-secondary">
                      “{q}”
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-muted">{noExamples}</p>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
