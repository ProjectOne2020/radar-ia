import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/panel";

const SECTIONS = [
  "dataCollected",
  "howWeUse",
  "sharing",
  "aiEngines",
  "security",
  "cookies",
  "retention",
  "rights",
  "changes",
  "contact",
] as const;

// M26 — Tratamiento de datos, pedido explicitamente por el fundador. Describe lo que
// el producto realmente recopila y con quien lo comparte (WhatsApp OTP, Stripe, los 4
// motores de IA, Resend, Supabase/Vercel) — no se inventan practicas que el codigo no
// implementa. Ver el aviso legal al pie sobre revision por abogado, dado que Radar IA
// opera en varios paises de LATAM con leyes de proteccion de datos distintas.
export default async function PrivacidadPage() {
  const t = await getTranslations("Privacidad");

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
