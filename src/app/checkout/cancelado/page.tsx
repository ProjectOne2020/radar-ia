import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { Panel } from "@/components/ui/panel";
import { ButtonLink } from "@/components/ui/button";

export default async function CanceladoPage() {
  const t = await getTranslations("CheckoutCancelado");

  return (
    <main>
      <Container narrow className="py-16">
        <Panel raised>
          <h1 className="text-2xl">{t("title")}</h1>
          <p className="mt-2 text-text-secondary">{t("body")}</p>
          <ButtonLink href="/dashboard/plan" variant="secondary" className="mt-5 inline-flex">
            {t("retry")}
          </ButtonLink>
        </Panel>
      </Container>
    </main>
  );
}
