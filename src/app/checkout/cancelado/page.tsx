import { getTranslations } from "next-intl/server";

export default async function CanceladoPage() {
  const t = await getTranslations("CheckoutCancelado");

  return (
    <main style={{ padding: 60, fontFamily: "sans-serif" }}>
      <h1>{t("title")}</h1>
      <p>{t("body")}</p>
      <a href="/dashboard/plan">{t("retry")}</a>
    </main>
  );
}
