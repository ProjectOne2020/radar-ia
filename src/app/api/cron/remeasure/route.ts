import { NextResponse } from "next/server";
import { remeasureDueClients } from "@/lib/cron/remeasure-due-clients";

// Vercel Cron llama esta ruta segun vercel.json e inyecta automaticamente
// "Authorization: Bearer $CRON_SECRET" — patron oficial de Vercel para autenticar crons
// sin exponer el endpoint publicamente. Puede tardar (mide varios clientes en serie,
// cada uno con llamadas reales a APIs de IA) — Vercel Cron no tiene el limite de 60s de
// una funcion invocada por usuario, pero igual se declara maxDuration explicito.
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await remeasureDueClients();
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
