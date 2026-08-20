import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin/is-admin";
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
  const { data: subscription } = await supabase.from("subscriptions").select("plan, status").maybeSingle();

  return (
    <DashboardShell
      businessName={client?.business_name ?? t("yourBusiness")}
      plan={subscription?.plan ?? null}
      planStatus={subscription?.status ?? null}
      isAdmin={isAdminEmail(user.email)}
    >
      {children}
    </DashboardShell>
  );
}
