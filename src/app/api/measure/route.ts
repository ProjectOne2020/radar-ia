import { NextResponse } from "next/server";
import { runMeasurementForPromptSet } from "@/lib/ai-engines/run-measurement";

// Disparo manual de M2 para pruebas (y, en M11, el cron de re-medicion lo llamara
// internamente en vez de por HTTP). Pega directo a APIs de pago — protegido por secreto.
export async function POST(request: Request) {
  const secret = request.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_MEASURE_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const promptSetId = body?.promptSetId;
  if (!promptSetId || typeof promptSetId !== "string") {
    return NextResponse.json({ error: "promptSetId requerido" }, { status: 400 });
  }

  try {
    const summary = await runMeasurementForPromptSet(promptSetId);
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
