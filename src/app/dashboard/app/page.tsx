import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/panel";
import AppForm from "./app-form";

// M16 — UI de dashboard para el eje apps. Tener una fila en app_listings es lo que
// activa la variante apps del score (pilares 2, 4 y 7) — ver calculate-score.ts.
export default async function AppPage() {
  const t = await getTranslations("DashboardApp");
  const supabase = await createClient();

  const { data: appListing } = await supabase.from("app_listings").select("*").maybeSingle();

  return (
    <>
      <h1 className="text-2xl sm:text-3xl">{t("title")}</h1>
      <p className="mt-2 max-w-[64ch] text-text-secondary">{t("intro")}</p>

      <div className="mt-6 max-w-[420px]">
        <AppForm appListing={appListing} />
      </div>

      {appListing && !appListing.landing_url && (
        <Alert tone="neutral" className="mt-6 max-w-[420px]">
          {t("noLandingNote")}
        </Alert>
      )}
    </>
  );
}
