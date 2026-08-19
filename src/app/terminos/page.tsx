import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/panel";

const SECTIONS = [
  "service",
  "accounts",
  "freeAudit",
  "billing",
  "guarantee",
  "ownership",
  "acceptableUse",
  "cancellation",
  "changes",
  "law",
  "contact",
] as const;

// M26 — Terminos y condiciones, pedidos explicitamente por el fundador ("una pagina
// tambien con link desde cualquier parte de la app con los terminos y condiciones").
// Contenido basado en lo que el producto realmente hace/cobra (no se inventa ningun
// termino legal que no se derive de la funcionalidad real construida) — ver el aviso
// al pie de la pagina sobre revision legal.
export default async function TerminosPage() {
  const t = await getTranslations("Terminos");

  return (
    <>
      <SiteHeader />
      <main>
        <Container narrow className="py-10 sm:py-16">
          <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>
          <p className="mt-2 text-sm text-text-muted">{t("lastUpdated")}</p>

          <Alert tone="signal" className="mt-6">
            {t("legalNote")}
          </Alert>

          <div className="mt-10 flex flex-col gap-8">
            {SECTIONS.map((key) => (
              <section key={key}>
                <h2 className="text-lg font-semibold text-ink">{t(`${key}Title`)}</h2>
                <p className="mt-2 max-w-[70ch] whitespace-pre-line text-sm leading-relaxed text-text-secondary">
                  {t(`${key}Body`)}
                </p>
              </section>
            ))}
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
