import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// M27 — toggle de opt-in al listado público (05-MARKETING-DISTRIBUCION.md seccion 2.3).
// clients.public_listing_opt_in se escribe con service_role a proposito, igual que
// verification_status en /api/auth/otp/verify: el UPDATE sobre `clients` esta revocado
// para el rol authenticated desde M22 (evita que el navegador pueda tocar columnas
// sensibles como plan/verification_status), asi que cualquier escritura a esta tabla
// pasa por el servidor. clientId sale del JWT de la sesion, nunca del body — nadie
// puede activar/desactivar el listado de otro negocio.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No hay sesión activa." }, { status: 401 });

  const clientId = user.app_metadata?.client_id as string | undefined;
  if (!clientId) return NextResponse.json({ error: "Sesión sin client_id." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const optIn = body?.optIn;
  if (typeof optIn !== "boolean") {
    return NextResponse.json({ error: "optIn debe ser true o false." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("clients").update({ public_listing_opt_in: optIn }).eq("id", clientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ publicListingOptIn: optIn });
}
