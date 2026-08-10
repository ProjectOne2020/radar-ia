import { createAdminClient } from "@/lib/supabase/admin";

// Ventana de dedup domain+phone: 03-ARQUITECTURA-TECNICA.md fija "ultimos 30 dias" en el
// comentario SQL de free_audits, y 04-MODULOS-CONSTRUCCION.md M6 lo confirma en su criterio
// de "terminado" ("un segundo intento del mismo dominio antes de 30 dias es rechazado
// correctamente") — 30 es el numero literal a implementar, no el rango 30-60 mas general
// de 01-CONTEXTO-NEGOCIO.md.
const DEDUP_WINDOW_DAYS = 30;

// Limite por IP/dia: 01-CONTEXTO-NEGOCIO.md lo da como ejemplo ("ej. 3-5 auditorias/dia"),
// no como cifra literal — se elige 3 (el limite mas estricto del rango sugerido) como punto
// de partida conservador, ajustable.
const IP_DAILY_LIMIT = 3;

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
}

export async function checkFreeAuditRateLimit(domain: string, phone: string, ip: string): Promise<RateLimitResult> {
  const admin = createAdminClient();

  const dedupSince = new Date(Date.now() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentSameBusiness, error: dedupError } = await admin
    .from("free_audits")
    .select("id")
    .eq("domain", domain)
    .eq("phone_whatsapp", phone)
    .gte("requested_at", dedupSince)
    .limit(1);

  if (dedupError) throw new Error(`No se pudo verificar anti-abuso (dedup): ${dedupError.message}`);
  if ((recentSameBusiness ?? []).length > 0) {
    return {
      allowed: false,
      reason: `Ya se solicitó una auditoría gratis para este negocio en los últimos ${DEDUP_WINDOW_DAYS} días. Intenta de nuevo más adelante.`,
    };
  }

  const todaySince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentFromIp, error: ipError } = await admin
    .from("free_audits")
    .select("id")
    .eq("ip_address", ip)
    .gte("requested_at", todaySince);

  if (ipError) throw new Error(`No se pudo verificar anti-abuso (IP): ${ipError.message}`);
  if ((recentFromIp ?? []).length >= IP_DAILY_LIMIT) {
    return {
      allowed: false,
      reason: "Se alcanzó el límite de auditorías gratis desde esta conexión hoy. Intenta mañana.",
    };
  }

  return { allowed: true };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
