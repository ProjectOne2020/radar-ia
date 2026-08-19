// IP real del cliente, resistente a spoofing.
//
// El bug original: se leia `x-forwarded-for` y se tomaba el PRIMER valor. Ese
// header es una lista que el proxy va concatenando, y cualquiera puede mandar
// su propio `X-Forwarded-For: 1.2.3.4` — el valor del atacante queda primero y
// el real al final. Tomar el primero significaba que el limite por IP de la
// auditoria gratis (que corre llamadas REALES y de pago a 4 motores de IA) se
// saltaba cambiando un header en cada request.
//
// En Vercel, `x-vercel-forwarded-for` y `x-real-ip` los escribe la plataforma y
// no son falsificables por el cliente. Se usan primero; solo si no existen se
// cae a `x-forwarded-for` tomando el ULTIMO valor (el que agrego el proxy mas
// cercano), no el primero.
export function getClientIp(request: Request): string {
  const vercelForwarded = request.headers.get("x-vercel-forwarded-for");
  if (vercelForwarded) {
    const first = vercelForwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    // El ultimo lo agrega el hop mas cercano y confiable, no el cliente.
    const last = parts[parts.length - 1];
    if (last) return last;
  }

  return "unknown";
}
