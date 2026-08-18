import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import AppForm from "./app-form";

// M16 — UI de dashboard para el eje apps. Tener una fila en app_listings es lo que
// activa la variante apps del score (pilares 2, 4 y 7) — ver calculate-score.ts.
export default async function AppPage() {
  const t = await getTranslations("DashboardApp");
  const tCommon = await getTranslations("Common");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appListing } = await supabase.from("app_listings").select("*").maybeSingle();

  return (
    <main style={{ padding: 60, maxWidth: 720, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/dashboard">{tCommon("back")}</Link>
      </p>
      <h1>{t("title")}</h1>
      <p>{t("intro")}</p>

      <AppForm appListing={appListing} />

      {appListing && !appListing.landing_url && (
        <p style={{ marginTop: 16, fontSize: 12, color: "#666" }}>{t("noLandingNote")}</p>
      )}
    </main>
  );
}
