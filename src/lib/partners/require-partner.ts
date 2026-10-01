import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PartnerAccount {
  id: string;
  agency_name: string;
  email: string | null;
  country: string | null;
  revenue_share_pct: number | null;
  status: string | null;
  stripe_connect_account_id: string | null;
  connect_onboarding_status: string;
}

// Mismo patron que requireAdmin(): sesion de Supabase Auth + lookup, pero aqui el "permiso"
// no es un email en una lista fija sino tener una fila activa en partner_accounts ligada a
// este usuario (auth_user_id). El panel de agencias lee todo con el cliente admin
// (service_role) despues de esta verificacion — partner_commissions y la atribucion de
// clientes nunca se exponen via RLS al navegador de la agencia.
export async function requirePartner(): Promise<PartnerAccount> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/partners/login");

  const admin = createAdminClient();
  const { data: partner } = await admin
    .from("partner_accounts")
    .select("id, agency_name, email, country, revenue_share_pct, status, stripe_connect_account_id, connect_onboarding_status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!partner || partner.status !== "active") redirect("/partners/login");

  return partner;
}
