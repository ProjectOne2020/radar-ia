import { createHash, timingSafeEqual } from "crypto";

// Comparacion de secretos en tiempo constante. Comparar con `===` filtra
// informacion por el tiempo de respuesta (sale en el primer byte distinto).
// Se hashean ambos lados primero para que la comparacion trabaje siempre sobre
// buffers del mismo largo — timingSafeEqual lanza si difieren en longitud, y esa
// diferencia de longitud seria en si misma una filtracion.
export function timingSafeEqualString(a: string, b: string): boolean {
  const aHash = createHash("sha256").update(a).digest();
  const bHash = createHash("sha256").update(b).digest();
  return timingSafeEqual(aHash, bHash);
}
