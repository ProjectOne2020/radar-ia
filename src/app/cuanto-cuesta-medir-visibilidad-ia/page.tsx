import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { JsonLd } from "@/components/seo/json-ld";

// M28 — dogfooding pilar 5. Ver comentario de cabecera en /que-es-geo/page.tsx.
// Precios de mercado citados como referencia investigada (sep/2026), no verificados en
// tiempo real — el copy lo aclara explicitamente porque estos precios cambian seguido y
// no queremos dejar una cifra que se vuelva falsa con el tiempo sin advertencia.
export default async function CuantoCuestaIAPage() {
  const t = await getTranslations("CuantoCuestaIA");

  const faqs = [
    { q: t("q1"), a: t("a1") },
    { q: t("q2"), a: t("a2") },
    { q: t("q3"), a: t("a3") },
    { q: t("q4"), a: t("a4") },
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
        <Container narrow className="py-10 sm:py-16">
          <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>
          <p className="mt-3 max-w-[64ch] text-text-secondary">{t("hook")}</p>

          <div className="mt-10 flex flex-col divide-y divide-border border-t border-border">
            {faqs.map((faq) => (
              <div key={faq.q} className="py-6 first:pt-0">
                <h2 className="text-lg font-semibold text-ink">{faq.q}</h2>
                <p className="mt-2 max-w-[64ch] text-sm leading-relaxed text-text-secondary">{faq.a}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 border-t border-border pt-10">
            <ButtonLink href="/precios" size="lg">
              {t("ctaPricing")}
            </ButtonLink>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
