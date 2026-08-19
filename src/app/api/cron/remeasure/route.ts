import { NextResponse } from "next/server";
import { remeasureDueClients } from "@/lib/cron/remeasure-due-clients";
import { timingSafeEqualString } from "@/lib/security/timing-safe";

// Vercel Cron llama esta ruta segun vercel.json e inyecta automaticamente
// "Authorization: Bearer $CRON_SECRET" — patron oficial de Vercel para autenticar crons
// sin exponer el endpoint publicamente. Puede tardar (mide varios clientes en serie,
// cada uno con llamadas reales a APIs de IA) — Vercel Cron no tiene el limite de 60s de
// una funcion invocada por usuario, pero igual se declara maxDuration explicito.
export const maxDuration = 300;

export async function GET(request: Request) {
  // Si CRON_SECRET no estuviera configurado, la comparacion original construia
  // literalmente "Bearer undefined" y cualquiera que mandara ese header exacto
  // disparaba un job de 300s que golpea todas las APIs de IA de pago. Ahora falta
  // de secreto = 500, nunca acceso.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !timingSafeEqualString(authHeader, `Bearer ${cronSecret}`)) {
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
