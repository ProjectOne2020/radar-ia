import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin/is-admin";
import { generateSolutionsForFindings, type FindingInput } from "@/lib/audit/generate-solutions";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { business, findings } = body ?? {};

  if (!business?.name || !business?.niche || !business?.country || !Array.isArray(findings)) {
    return NextResponse.json({ error: "business (name, niche, country) y findings son requeridos" }, { status: 400 });
  }

  try {
    const solutions = await generateSolutionsForFindings(business, findings as FindingInput[]);
    return NextResponse.json({ solutions });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
