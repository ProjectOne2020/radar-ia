import { NextResponse } from "next/server";
import { runAuditForClient } from "@/lib/audit/run-audit";
import { requireInternalSecret } from "@/lib/security/internal-secret";

// Disparo manual de M3 para pruebas. Mismo secreto que /api/measure.
export async function POST(request: Request) {
  const denied = requireInternalSecret(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const clientId = body?.clientId;
  // P0.2-B — los hallazgos pertenecen a una sesion. Un finding sin sesion seria evidencia
  // huerfana que ningun score podria explicar, asi que el disparo manual tambien declara
  // a que sesion contribuye.
  const sessionId = body?.sessionId;
  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json({ error: "clientId requerido" }, { status: 400 });
  }
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "sessionId requerido" }, { status: 400 });
  }

  try {
    const summary = await runAuditForClient(clientId, sessionId);
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
