import { NextResponse } from "next/server";
import { sendReportForClient } from "@/lib/reports/send-report";

// Disparo manual de M10 para pruebas (M11 lo llamara internamente segun el cron por plan).
export async function POST(request: Request) {
  const secret = request.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_MEASURE_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const clientId = body?.clientId;
  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json({ error: "clientId requerido" }, { status: 400 });
  }

  try {
    const result = await sendReportForClient(clientId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
