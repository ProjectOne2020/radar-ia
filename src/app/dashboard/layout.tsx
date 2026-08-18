import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";

// M7 — chrome compartido de todo /dashboard/*: la sesion se valida una sola vez aqui
// (RLS) en vez de repetirla en cada page.tsx, y el nombre del negocio para el header se
// resuelve aqui tambien. Cada page.tsx sigue haciendo sus propias queries para datos
// especificos de esa pantalla (score, hallazgos, citas, etc.).
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("Dashboard");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase.from("clients").select("business_name").single();

  return <DashboardShell businessName={client?.business_name ?? t("yourBusiness")}>{children}</DashboardShell>;
}
