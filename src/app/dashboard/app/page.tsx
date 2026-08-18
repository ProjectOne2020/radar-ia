import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppForm from "./app-form";

// M16 — UI de dashboard para el eje apps. Tener una fila en app_listings es lo que
// activa la variante apps del score (pilares 2, 4 y 7) — ver calculate-score.ts.
export default async function AppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appListing } = await supabase.from("app_listings").select("*").maybeSingle();

  return (
    <main style={{ padding: 60, maxWidth: 720, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/dashboard">← Volver</Link>
      </p>
      <h1>Tu app</h1>
      <p>
        Configura tu app para activar el score de la variante apps (pilar 2: completitud de la ficha en App Store /
        Google Play; pilar 4: schema.org SoftwareApplication en tu landing; pilar 7: rating de la tienda).
      </p>

      <AppForm appListing={appListing} />

      {appListing && !appListing.landing_url && (
        <p style={{ marginTop: 16, fontSize: 12, color: "#666" }}>
          Sin landing configurada: los pilares de crawlability/schema/cobertura de preguntas quedarán sin medir
          hasta que agregues la URL de tu sitio de marketing.
        </p>
      )}
    </main>
  );
}
