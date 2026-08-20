import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { grantTemporaryPlan } from "@/lib/admin/trial-grant";
import { upgradeAuditForClient } from "@/lib/audit/upgrade-audit";

export const maxDuration = 300;

export async function POST(request: Request) {
  const secret = request.headers.get("x-debug-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { clientId, plan, audits } = await request.json();
  const admin = createAdminClient();

  const grantResult = await grantTemporaryPlan(admin, clientId, plan, audits);
  if (grantResult.error) return NextResponse.json({ error: grantResult.error }, { status: 400 });

  await upgradeAuditForClient(admin, clientId, plan);

  const { data: grant } = await admin.from("trial_grants").select("*").eq("client_id", clientId).single();
  const { data: sub } = await admin.from("subscriptions").select("*").eq("client_id", clientId).single();

  return NextResponse.json({ grant, sub });
}
