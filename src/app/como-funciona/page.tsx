import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui/container";
import { Panel, Alert } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

const PILLARS = [
  { key: "1", weight: 12 },
  { key: "2_local", weight: 20 },
  { key: "3", weight: 12 },
  { key: "4_local", weight: 8 },
  { key: "5", weight: 12 },
  { key: "6", weight: 15 },
  { key: "7_local", weight: 8 },
  { key: "8", weight: 13 },
] as const;

const AXES = ["local", "ecommerce", "app"] as const;

// M25 — pagina publica de "como funciona", pedida explicitamente por el fundador
// ("la landing debe tener una seccion o llevar a otra pagina donde se explique
// detalladamente como funciona la app para el usuario"). El landing ya tenia una
// version corta de 3 pasos (seccion PROCESO de src/app/page.tsx) — esta pagina la
// expande con el detalle real del producto (8 pilares y pesos literales de
// 02-METODOLOGIA-SCORING.md, los 3 ejes, cadencia de medicion por plan), sin
// inventar nada que no este ya documentado o construido.
export default async function ComoFuncionaPage() {
  const t = await getTranslations("ComoFunciona");
  const home = await getTranslations("Home");
  const p = await getTranslations("Pillars");
  const audit = await getTranslations("AuditoriaGratis");
  const precios = await getTranslations("Precios");

  const steps = [
    { title: t("step1Title"), body: t("step1Body") },
    { title: t("step2Title"), body: t("step2Body") },
    { title: t("step3Title"), body: t("step3Body") },
    { title: t("step4Title"), body: t("step4Body") },
  ];

  const cadences = [
    { plan: "Lite", body: precios("featuresLite") },
    { plan: "Plus", body: precios("featuresPlus") },
    { plan: "Pro", body: precios("featuresPro") },
    { plan: "Enterprise", body: precios("featuresEnterprise") },
  ];

  return (
    <>
      <SiteHeader />
      <main>
        <Container narrow className="py-10 sm:py-16">
          <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>
          <p className="mt-3 max-w-[64ch] text-text-secondary">{t("hook")}</p>

          {/* Los 4 pasos, en detalle */}
          <ol className="mt-10 flex flex-col gap-8">
            {steps.map((step, i) => (
              <li key={step.title} className="border-t-2 border-ink pt-4">
                <span className="font-mono text-xs text-text-muted">{String(i + 1).padStart(2, "0")}</span>
                <h2 className="mt-2 text-lg font-semibold text-ink">{step.title}</h2>
                <p className="mt-2 max-w-[64ch] text-sm leading-relaxed text-text-secondary">{step.body}</p>
              </li>
            ))}
          </ol>

          {/* Los 8 pilares y sus pesos */}
          <div className="mt-14">
            <h2 className="text-xl font-semibold text-ink">{t("pillarsTitle")}</h2>
            <p className="mt-2 max-w-[64ch] text-sm text-text-secondary">{t("pillarsBody")}</p>
            <Panel className="mt-5 divide-y divide-border p-0">
              {PILLARS.map((pillar) => (
                <div key={pillar.key} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-sm text-text">{p(pillar.key)}</span>
                  <span className="font-mono text-xs text-text-muted">{pillar.weight}%</span>
                </div>
              ))}
            </Panel>
          </div>

          {/* Los 3 ejes */}
          <div className="mt-14">
            <h2 className="text-xl font-semibold text-ink">{t("axesTitle")}</h2>
            <p className="mt-2 max-w-[64ch] text-sm text-text-secondary">{t("axesBody")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {AXES.map((axis) => (
                <Badge key={axis} tone="neutral">
                  {audit(`axis_${axis}`)}
                </Badge>
              ))}
            </div>
          </div>

          {/* Cadencia de medicion por plan */}
          <div className="mt-14">
            <h2 className="text-xl font-semibold text-ink">{t("cadenceTitle")}</h2>
            <p className="mt-2 max-w-[64ch] text-sm text-text-secondary">{t("cadenceBody")}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {cadences.map((c) => (
                <Panel key={c.plan}>
                  <h3 className="text-sm font-semibold text-ink">{c.plan}</h3>
                  <p className="mt-1.5 text-sm text-text-secondary">{c.body}</p>
                </Panel>
              ))}
            </div>
          </div>

          {/* Garantia, misma declaracion que el landing */}
          <div className="mt-14">
            <h2 className="text-xl font-semibold text-ink">{home("guaranteeTitle")}</h2>
            <Alert tone="signal" className="mt-4">
              {home("guaranteeBody")}
            </Alert>
          </div>

          <div className="mt-14 flex flex-wrap gap-3 border-t border-border pt-10">
            <ButtonLink href="/auditoria-gratis" size="lg">
              {t("ctaAudit")}
            </ButtonLink>
            <ButtonLink href="/precios" variant="secondary" size="lg">
              {t("ctaPricing")}
            </ButtonLink>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
