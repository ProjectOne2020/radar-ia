import { createAdminClient } from "@/lib/supabase/admin";

// Rate limiter generico para endpoints publicos sin sesion. Persiste en la tabla
// rate_limit_events (RLS on, sin policies — solo service_role), no en memoria:
// en Vercel cada invocacion puede caer en una instancia distinta, asi que un
// contador en memoria no limita nada real.
export interface RateLimitRule {
  bucket: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitOutcome {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export async function checkRateLimit(rule: RateLimitRule): Promise<RateLimitOutcome> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - rule.windowSeconds * 1000).toISOString();

  const { count, error } = await admin
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("bucket", rule.bucket)
    .eq("identifier", rule.identifier)
    .gte("created_at", since);

  // Fail-closed: si no se puede verificar el limite, se rechaza. Un error de DB
  // no debe convertirse en una puerta abierta a un endpoint caro.
  if (error) {
    return { allowed: false, retryAfterSeconds: rule.windowSeconds };
  }

  if ((count ?? 0) >= rule.limit) {
    return { allowed: false, retryAfterSeconds: rule.windowSeconds };
  }

  return { allowed: true };
}

export async function recordRateLimitHit(bucket: string, identifier: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("rate_limit_events").insert({ bucket, identifier });
}

// Conveniencia: verifica y registra en un solo paso. Devuelve false si ya no
// quedan intentos disponibles en la ventana.
export async function consumeRateLimit(rule: RateLimitRule): Promise<RateLimitOutcome> {
  const outcome = await checkRateLimit(rule);
  if (!outcome.allowed) return outcome;
  await recordRateLimitHit(rule.bucket, rule.identifier);
  return outcome;
}

export function tooManyRequests(message: string, retryAfterSeconds?: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      ...(retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : {}),
    },
  });
}
