import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { ScoreInstrument } from "@/components/radar/score-instrument";
import { PillarSignal, type PillarStatus } from "@/components/radar/pillar-signal";

// Landing publica de "/". Estructura: pregunta -> deteccion -> evidencia -> accion
// (constitucion de diseno, ahora nativa en 03-ARQUITECTURA-TECNICA.md). El panel de
// score/pilares en el hero usa datos de ejemplo explicitamente etiquetados (exampleLabel/
// exampleNote) para mostrar el producto real sin inventar resultados de un negocio real —
// ver 01-CONTEXTO-NEGOCIO.md regla de no fabricar metricas.
const EXAMPLE_PILLARS: Array<{
  key: string;
  weight: number;
  status: PillarStatus;
  value?: number;
}> = [
  { key: "1", weight: 12, status: "good", value: 90 },
  { key: "2_local", weight: 20, status: "warning", value: 55 },
  { key: "3", weight: 12, status: "good", value: 85 },
  { key: "4_local", weight: 8, status: "unmeasured" },
  { key: "5", weight: 12, status: "warning", value: 40 },
  { key: "6", weight: 15, status: "critical", value: 15 },
  { key: "7_local", weight: 8, status: "good", value: 78 },
  { key: "8", weight: 13, status: "warning", value: 45 },
];
const EXAMPLE_SCORE = 51;

export default async function Home() {
  const t = await getTranslations("Home");
  const p = await getTranslations("Pillars");
  const n = await getTranslations("Niches");
  const c = await getTranslations("Common");
  const notMeasuredLabel = await getTranslations("Dashboard").then((d) => d("notMeasured"));

  const steps = [
    { title: t("step1Title"), body: t("step1Body") },
    { title: t("step2Title"), body: t("step2Body") },
    { title: t("step3Title"), body: t("step3Body") },
  ];

  const niches = ["dental", "estetica", "inmobiliaria", "ecommerce", "app"] as const;

  return (
    <>
      <SiteHeader />
      <main>
        {/* HERO — pregunta + evidencia real del producto (no ilustracion) */}
        <section className="border-b border-border">
          <Container className="grid gap-12 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-28">
            <div>
              <p className="mb-4 font-mono text-xs uppercase tracking-[0.14em] text-signal-strong">
                {t("tagline")}
              </p>
              <h1 className="text-[2.05rem] leading-[1.14] sm:text-5xl lg:text-[3.25rem]">
                {t("hookQuestion")}
              </h1>
              <p className="mt-5 max-w-[46ch] text-lg text-text-secondary">{t("hookSub")}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/auditoria-gratis" size="lg">
                  {t("ctaAudit")}
                </ButtonLink>
                <ButtonLink href="/precios" variant="secondary" size="lg">
                  {t("ctaPricing")}
                </ButtonLink>
              </div>
              <p className="mt-6 text-sm text-text-muted">
                {t("hasAccount")}{" "}
                <Link href="/login" className="text-text underline underline-offset-2">
                  {t("login")}
                </Link>
              </p>
            </div>

            <div className="rounded-lg border border-border bg-paper-raised p-6 shadow-md sm:p-7">
              <span className="font-mono text-[0.7rem] uppercase tracking-wider text-text-muted">
                {t("exampleLabel")}
              </span>

              <div className="mt-4">
                <ScoreInstrument
                  score={EXAMPLE_SCORE}
                  noiseLabel={c("noise")}
                  signalLabel={c("signal")}
                  size="md"
                />
              </div>

              <div className="mt-5 divide-y divide-border border-t border-border">
                {EXAMPLE_PILLARS.map((pillar) => (
                  <PillarSignal
                    key={pillar.key}
                    name={p(pillar.key)}
                    weight={pillar.weight}
                    status={pillar.status}
                    value={pillar.value}
                    notMeasuredLabel={notMeasuredLabel}
                  />
                ))}
              </div>

              <p className="mt-4 text-xs text-text-muted">{t("exampleNote")}</p>
            </div>
          </Container>
        </section>

        {/* PROCESO — deteccion -> evidencia -> accion, no una grilla de "features" */}
        <section className="border-b border-border bg-surface">
          <Container className="py-14 sm:py-20">
            <h2 className="text-2xl sm:text-[1.75rem]">{t("processTitle")}</h2>
            <p className="mt-3 max-w-[64ch] text-text-secondary">{t("whatWeDoBody")}</p>

            <ol className="mt-10 grid gap-8 sm:grid-cols-3">
              {steps.map((step, i) => (
                <li key={step.title} className="border-t-2 border-ink pt-4">
                  <span className="font-mono text-xs text-text-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 text-lg font-semibold text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">{step.body}</p>
                </li>
              ))}
            </ol>
          </Container>
        </section>

        {/* GARANTIA — declaracion de confianza explicita, no letra chica */}
        <section className="border-b border-border">
          <Container narrow className="py-14 sm:py-20">
            <h2 className="text-2xl sm:text-[1.75rem]">{t("guaranteeTitle")}</h2>
            <Alert tone="signal" className="mt-6">
              {t("guaranteeBody")}
            </Alert>
          </Container>
        </section>

        {/* PARA QUIEN — los 3 ejes como un solo sistema */}
        <section>
          <Container className="py-14 sm:py-20">
            <h2 className="text-2xl sm:text-[1.75rem]">{t("forWhomTitle")}</h2>
            <p className="mt-3 max-w-[64ch] text-text-secondary">{t("forWhomBody")}</p>
            <p className="mt-6 font-mono text-xs uppercase tracking-wider text-text-muted">
              {t("forWhomExamplesLabel")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {niches.map((key) => (
                <Badge key={key} tone="neutral">
                  {n(key)}
                </Badge>
              ))}
            </div>
          </Container>
        </section>

        <footer className="border-t border-border">
          <Container className="flex flex-col items-start justify-between gap-3 py-8 text-sm text-text-muted sm:flex-row sm:items-center">
            <span>{t("brand")}</span>
            <span>{t("tagline")}</span>
          </Container>
        </footer>
      </main>
    </>
  );
}
