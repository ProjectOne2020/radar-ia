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
import { CoverageConstellation } from "@/components/radar/coverage-constellation";
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
  const c = await getTranslations("Common");
  const notMeasuredLabel = await getTranslations("Dashboard").then((d) => d("notMeasured"));

  const steps = [
    { title: t("step1Title"), body: t("step1Body") },
    { title: t("step2Title"), body: t("step2Body") },
    { title: t("step3Title"), body: t("step3Body") },
  ];

  const niches = [
    { key: "dental", title: t("forWhomDentalTitle"), body: t("forWhomDentalBody") },
    { key: "estetica", title: t("forWhomEsteticaTitle"), body: t("forWhomEsteticaBody") },
    {
      key: "inmobiliaria",
      title: t("forWhomInmobiliariaTitle"),
      body: t("forWhomInmobiliariaBody"),
    },
    { key: "ecommerce", title: t("forWhomEcommerceTitle"), body: t("forWhomEcommerceBody") },
    { key: "app", title: t("forWhomAppTitle"), body: t("forWhomAppBody") },
  ] as const;
  // Ciclo de tonos de marca para las tarjetas de "para quien" — mismos tokens del
  // sistema de Badge (nunca colores sueltos); 5 tonos para 5 nichos, sin repetir.
  const nicheTones = ["signal", "observed", "warning", "good", "critical"] as const;

  // Barra de credibilidad (cifras reales, no proyectadas — ver nota de no fabricar
  // metricas en 01-CONTEXTO-NEGOCIO.md). Verificado contra Supabase antes de escribir
  // estos valores; actualizar aqui si el banco de preguntas crece de forma material.
  const stats = [
    { value: t("stat1Value"), label: t("stat1Label") },
    { value: t("stat2Value"), label: t("stat2Label") },
    { value: t("stat3Value"), label: t("stat3Label") },
    { value: t("stat4Value"), label: t("stat4Label") },
  ];

  // Dogfooding (05-MARKETING-DISTRIBUCION.md 2.4): mismo contenido de respuesta directa
  // que el pilar 5 audita en los clientes, aplicado al propio sitio — preguntas reales
  // que alguien le haria a una IA sobre el producto, con respuestas que reusan el texto
  // ya validado del resto de la pagina (nada nuevo inventado para el schema).
  const faqs = [
    { q: t("faq1Q"), a: t("whatWeDoBody") },
    { q: t("faq2Q"), a: t("faq2A") },
    { q: t("faq3Q"), a: t("guaranteeBody") },
    { q: t("faq4Q"), a: t("faq4A") },
    { q: t("faq5Q"), a: t("faq5A") },
    { q: t("faq6Q"), a: t("faq6A") },
    { q: t("faq7Q"), a: t("faq7A") },
    { q: t("faq8Q"), a: t("faq8A") },
    { q: t("faq9Q"), a: t("faq9A") },
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
        {/* HERO — pregunta + evidencia real del producto (no ilustracion).
            rd-mesh (M22): glow de marca en vez de bloque solido, mismo
            lenguaje que "AI visibility checker" de la competencia (Ahrefs/
            Trendos/Omnia) pero sobre la base oscura + radios de precision
            propios en vez de su modo claro/burbujas — ver globals.css. */}
        <section className="relative isolate overflow-hidden border-b border-border rd-mesh">
          <Container className="grid gap-12 py-16 sm:py-24 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-32">
            <div>
              <Badge tone="signal">{t("tagline")}</Badge>
              <h1 className="mt-5 text-[2.1rem] leading-[1.12] sm:text-5xl lg:text-[3.4rem]">
                {t("hookQuestion")}
              </h1>
              <p className="mt-5 max-w-[46ch] text-lg text-text-secondary">{t("hookSub")}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/auditoria-gratis" size="lg" className="rd-glow-primary">
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

            <div className="relative rounded-lg border border-border-strong bg-paper-raised p-6 shadow-lg sm:p-7 rd-grid-bg">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-signal to-transparent"
              />
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

        {/* CIFRAS — banda de alto contraste con peso visual real: fondo mas oscuro que
            sus vecinas (surface-sunken) + rd-mesh completo (no atenuado) + la
            constelacion de 18 paises como imagen, mismo tratamiento de "instrumento
            de precision" que el panel del hero pero a escala de seccion completa.
            Grid simetrico imagen/cifras en desktop, apilado en mobile. */}
        <section className="relative isolate overflow-hidden border-b border-border bg-surface-sunken rd-mesh">
          <Container className="grid gap-10 py-16 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="flex justify-center lg:order-2">
              <CoverageConstellation
                centerLabel={t("brand")}
                className="h-72 w-72 sm:h-80 sm:w-80 lg:h-96 lg:w-96"
              />
            </div>
            <div className="lg:order-1">
              <p className="font-mono text-xs uppercase tracking-wider text-signal-strong">
                {t("statsTitle")}
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-8">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <dt className="sr-only">{stat.label}</dt>
                    <dd className="font-mono text-3xl font-semibold text-ink sm:text-4xl">
                      {stat.value}
                    </dd>
                    <p className="mt-1.5 text-sm leading-snug text-text-secondary">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </dl>
              <p className="mt-8 max-w-[46ch] text-sm text-text-muted">{t("statsNote")}</p>
            </div>
          </Container>
        </section>

        {/* PROCESO — deteccion -> evidencia -> accion, no una grilla de "features".
            Pasos como tarjetas-instrumento (numero en chip mono + borde que se
            ilumina en signal) en vez de una simple regla superior — mismo
            lenguaje "panel de medicion" que el demo del hero. */}
        <section className="border-b border-border bg-surface">
          <Container className="py-16 sm:py-24">
            <h2 className="text-2xl sm:text-[1.75rem]">{t("processTitle")}</h2>
            <p className="mt-4 max-w-[64ch] text-text-secondary">{t("whatWeDoBody")}</p>

            <ol className="mt-10 grid gap-5 sm:grid-cols-3">
              {steps.map((step, i) => (
                <li
                  key={step.title}
                  className="group relative overflow-hidden rounded-md border border-border bg-paper-raised p-5 transition-colors duration-[var(--duration-micro)] hover:border-signal"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-instrument border border-border-strong font-mono text-xs text-signal-strong">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">{step.body}</p>
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-px scale-x-0 bg-signal transition-transform duration-[var(--duration-reveal)] group-hover:scale-x-100"
                  />
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

        {/* GARANTIA — declaracion de confianza explicita, no letra chica.
            Glow signal en el borde del Alert en vez de solo el borde plano,
            para que la garantia lea como la afirmacion mas fuerte de la
            pagina, no como un aviso legal. */}
        <section className="border-b border-border">
          <Container narrow className="py-16 sm:py-24">
            <h2 className="text-2xl sm:text-[1.75rem]">{t("guaranteeTitle")}</h2>
            <Alert tone="signal" className="mt-6 rd-glow-signal">
              {t("guaranteeBody")}
            </Alert>
          </Container>
        </section>

        {/* POR QUE EL DATO ES DISTINTO — motor propio (llamadas directas a las 4 APIs,
            sin revender otra herramienta) + banco de preguntas nativo por pais (sin
            plantillas traducidas). Credibilidad concreta, no adjetivos vacios como
            "el mejor" o "el mas completo". Dos tarjetas simetricas, mismo lenguaje
            visual de "tarjeta-instrumento" que la seccion de proceso. */}
        <section className="border-b border-border bg-surface">
          <Container className="py-16 sm:py-24">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="rounded-md border border-border bg-paper-raised p-6">
                <h3 className="text-lg font-semibold text-ink">{t("engineTitle")}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {t("engineBody")}
                </p>
              </div>
              <div className="rounded-md border border-border bg-paper-raised p-6">
                <h3 className="text-lg font-semibold text-ink">{t("bankTitle")}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {t("bankBody")}
                </p>
              </div>
            </div>
          </Container>
        </section>

        {/* PARA QUIEN — antes era una lista plana de badges; ahora cada nicho es su
            propia tarjeta-instrumento con el argumento de venta especifico de ese
            rubro (de 01-CONTEXTO-NEGOCIO.md seccion 5: dental/estetica tienen señal
            limpia, inmobiliaria compite con portales, e-commerce con marketplaces,
            apps es el eje mas nuevo). rd-mesh a intensidad completa + tono de marca
            distinto por tarjeta para que la seccion pese tanto como la de cifras. */}
        <section className="relative isolate overflow-hidden border-b border-border">
          <div aria-hidden className="pointer-events-none absolute inset-0 rd-mesh opacity-70" />
          <Container className="py-16 sm:py-24">
            <h2 className="text-2xl sm:text-[1.75rem]">{t("forWhomTitle")}</h2>
            <p className="mt-4 max-w-[64ch] text-lg text-text-secondary">{t("forWhomBody")}</p>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {niches.map((niche, i) => {
                const tone = nicheTones[i % nicheTones.length];
                return (
                  <div
                    key={niche.key}
                    className="group relative overflow-hidden rounded-md border border-border bg-paper-raised p-6 transition-colors duration-[var(--duration-micro)] hover:border-signal"
                  >
                    <Badge tone={tone}>{niche.title}</Badge>
                    <p className="mt-4 text-sm leading-relaxed text-text-secondary">
                      {niche.body}
                    </p>
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-px scale-x-0 bg-signal transition-transform duration-[var(--duration-reveal)] group-hover:scale-x-100"
                    />
                  </div>
                );
              })}
            </div>

            <Link
              href="/rubros"
              className="mt-10 inline-block text-sm font-medium text-text underline underline-offset-2"
            >
              {t("listadoCta")}
            </Link>
          </Container>
        </section>

        {/* PREGUNTAS FRECUENTES — dogfooding del pilar 5 (contenido de respuesta
            directa) sobre la marca misma, con JSON-LD FAQPage a juego */}
        <section className="border-t border-border bg-surface">
          <Container narrow className="py-16 sm:py-24">
            <h2 className="text-2xl sm:text-[1.75rem]">{t("faqTitle")}</h2>
            <div className="mt-8 flex flex-col divide-y divide-border border-t border-border">
              {faqs.map((faq) => (
                <div key={faq.q} className="py-6 first:pt-0">
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
