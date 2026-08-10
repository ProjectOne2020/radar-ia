import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Placeholder de M5 — prueba que la sesion queda ligada a client_id via RLS (M7 construye
// el dashboard real). Usa el cliente server (no admin): si esto muestra datos, es porque
// el custom claim app_metadata.client_id + la policy clients_select_own de M1 funcionan.
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: client, error } = await supabase
    .from("clients")
    .select("business_name, niche, plan, verification_status, created_at")
    .single();

  return (
    <main style={{ padding: 60, fontFamily: "sans-serif" }}>
      <h1>Dashboard (placeholder — M7 construye el real)</h1>
      <p>Sesión: {user.email}</p>
      <p>client_id (JWT app_metadata): {String(user.app_metadata?.client_id ?? "no enlazado")}</p>

      {error && <p style={{ color: "crimson" }}>No se pudo leer el negocio via RLS: {error.message}</p>}

      {client && (
        <div style={{ marginTop: 16 }}>
          <p>Negocio: {client.business_name}</p>
          <p>Rubro: {client.niche}</p>
          <p>Plan: {client.plan}</p>
          <p>Verificación: {client.verification_status}</p>
          {client.verification_status !== "verified" && (
            <p>
              <a href="/verificar">Completa la verificación por WhatsApp</a>
            </p>
          )}
        </div>
      )}
    </main>
  );
}
