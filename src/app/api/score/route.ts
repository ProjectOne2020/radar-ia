import { NextResponse } from "next/server";
import { calculateScoreForClient } from "@/lib/scoring/calculate-score";
import { requireInternalSecret } from "@/lib/security/internal-secret";

// Disparo manual de M4 para pruebas. Mismo secreto que /api/measure y /api/audit.
export async function POST(request: Request) {
  const denied = requireInternalSecret(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const clientId = body?.clientId;
  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json({ error: "clientId requerido" }, { status: 400 });
  }

  try {
    const result = await calculateScoreForClient(clientId, { isEcommerce: body?.isEcommerce });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
