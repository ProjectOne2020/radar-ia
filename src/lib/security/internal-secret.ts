import { timingSafeEqualString } from "./timing-safe";

// Gate compartido de los endpoints internos que pegan directo a APIs de IA de pago
// (/api/measure, /api/audit, /api/score). Devuelve null si la peticion es valida,
// o la Response de error si no.
export function requireInternalSecret(request: Request): Response | null {
  const expected = process.env.INTERNAL_MEASURE_SECRET;
  if (!expected) {
    return new Response(JSON.stringify({ error: "INTERNAL_MEASURE_SECRET no configurado." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const provided = request.headers.get("x-internal-secret");
  if (!provided || !timingSafeEqualString(provided, expected)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}
