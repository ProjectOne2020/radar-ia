import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { ScoreRing } from "@/components/radar/score-ring";
import { PillarSignal, type PillarStatus } from "@/components/radar/pillar-signal";
import { RadarNetwork } from "@/components/radar/radar-network";
import { JsonLd } from "@/components/seo/json-ld";

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

  // Dogfooding (05-MARKETING-DISTRIBUCION.md 2.4): mismo contenido de respuesta directa
  // que el pilar 5 audita en los clientes, aplicado al propio sitio — preguntas reales
  // que alguien le haria a una IA sobre el producto, con respuestas que reusan el texto
  // ya validado del resto de la pagina (nada nuevo inventado para el schema).
  const faqs = [
    { q: t("faq1Q"), a: t("whatWeDoBody") },
    { q: t("faq2Q"), a: t("faq2A") },
    { q: t("faq3Q"), a: t("guaranteeBody") },
    { q: t("faq4Q"), a: t("faq4A") },
  ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <JsonLd data={faqSchema} />
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

            <div className="rounded-lg border border-border bg-paper-raised p-6 shadow-md sm:p-7 rd-grid-bg">
              <div className="flex justify-center">
                <RadarNetwork className="h-44 w-44 sm:h-52 sm:w-52" />
              </div>

              <span className="mt-2 block text-center font-mono text-[0.7rem] uppercase tracking-wider text-text-muted">
                {t("exampleLabel")}
              </span>

              <div className="mt-4 border-t border-border pt-6">
                <ScoreRing
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

            <Link
              href="/como-funciona"
              className="mt-8 inline-block text-sm font-medium text-text underline underline-offset-2"
            >
              {t("howItWorksCta")}
            </Link>
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

            <Link
              href="/listado"
              className="mt-8 inline-block text-sm font-medium text-text underline underline-offset-2"
            >
              {t("listadoCta")}
            </Link>
          </Container>
        </section>

        {/* PREGUNTAS FRECUENTES — dogfooding del pilar 5 (contenido de respuesta
            directa) sobre la marca misma, con JSON-LD FAQPage a juego */}
        <section className="border-t border-border bg-surface">
          <Container narrow className="py-14 sm:py-20">
            <h2 className="text-2xl sm:text-[1.75rem]">{t("faqTitle")}</h2>
            <div className="mt-8 flex flex-col gap-8">
              {faqs.map((faq) => (
                <div key={faq.q}>
                  <h3 className="text-base font-semibold text-ink">{faq.q}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">{faq.a}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

      </main>
      <SiteFooter />
    </>
  );
}
