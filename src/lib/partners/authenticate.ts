import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey } from "./api-key";

export interface AuthenticatedPartner {
  id: string;
  agencyName: string;
}

// Convencion "Authorization: Bearer <api_key>" — mismo patron ya usado en el proyecto
// para CRON_SECRET (04-MODULOS-CONSTRUCCION.md M11), consistente en vez de inventar
// un header custom nuevo.
export async function authenticatePartner(request: Request): Promise<AuthenticatedPartner | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const apiKey = authHeader.slice("Bearer ".length).trim();
  if (!apiKey) return null;

  const admin = createAdminClient();
  const { data: partner } = await admin
    .from("partner_accounts")
    .select("id, agency_name, status")
    .eq("api_key", hashApiKey(apiKey))
    .eq("status", "active")
    .maybeSingle();

  if (!partner) return null;
  return { id: partner.id, agencyName: partner.agency_name };
}
