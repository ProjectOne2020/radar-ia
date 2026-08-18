import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "./is-admin";

// Todas las paginas /admin usan esto para verificar sesion + email admin antes de leer
// nada con el cliente service_role (bypasea RLS a proposito, es la superficie interna).
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    redirect("/login");
  }

  return user;
}
