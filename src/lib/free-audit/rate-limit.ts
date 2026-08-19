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

// Limite por telefono/dia, independiente de la IP. El limite por IP solo no basta:
// una botnet o un pool de proxies da IPs distintas gratis, y cada auditoria corre
// llamadas REALES y de pago a 4 motores de IA. El telefono es el recurso mas caro
// de rotar para un atacante (y ya es obligatorio para ver el reporte).
const PHONE_DAILY_LIMIT = 3;

// Techo global de auditorias gratis por hora. Ultima linea de defensa contra un
// ataque distribuido que rote IP y telefono: acota el gasto maximo de API de IA
// por hora aunque todo lo demas falle. Ajustable segun demanda real.
const GLOBAL_HOURLY_LIMIT = 60;

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

  // Dedup por dominio solo (sin telefono): antes se podia re-auditar el mismo
  // dominio infinitas veces cambiando el telefono, porque el dedup exigia que
  // AMBOS coincidieran.
  const { data: recentSameDomain, error: domainError } = await admin
    .from("free_audits")
    .select("id")
    .eq("domain", domain)
    .gte("requested_at", todaySince)
    .limit(1);

  if (domainError) throw new Error(`No se pudo verificar anti-abuso (dominio): ${domainError.message}`);
  if ((recentSameDomain ?? []).length > 0) {
    return {
      allowed: false,
      reason: "Este sitio ya se auditó hoy. Intenta mañana.",
    };
  }

  const { count: ipCount, error: ipError } = await admin
    .from("free_audits")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ip)
    .gte("requested_at", todaySince);

  if (ipError) throw new Error(`No se pudo verificar anti-abuso (IP): ${ipError.message}`);
  if ((ipCount ?? 0) >= IP_DAILY_LIMIT) {
    return {
      allowed: false,
      reason: "Se alcanzó el límite de auditorías gratis desde esta conexión hoy. Intenta mañana.",
    };
  }

  const { count: phoneCount, error: phoneError } = await admin
    .from("free_audits")
    .select("id", { count: "exact", head: true })
    .eq("phone_whatsapp", phone)
    .gte("requested_at", todaySince);

  if (phoneError) throw new Error(`No se pudo verificar anti-abuso (teléfono): ${phoneError.message}`);
  if ((phoneCount ?? 0) >= PHONE_DAILY_LIMIT) {
    return {
      allowed: false,
      reason: "Se alcanzó el límite de auditorías gratis para este número hoy. Intenta mañana.",
    };
  }

  const hourSince = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: globalCount, error: globalError } = await admin
    .from("free_audits")
    .select("id", { count: "exact", head: true })
    .gte("requested_at", hourSince);

  if (globalError) throw new Error(`No se pudo verificar anti-abuso (global): ${globalError.message}`);
  if ((globalCount ?? 0) >= GLOBAL_HOURLY_LIMIT) {
    return {
      allowed: false,
      reason: "Estamos recibiendo muchas solicitudes en este momento. Intenta de nuevo en un rato.",
    };
  }

  return { allowed: true };
}

// Reexportado desde el helper compartido: la version anterior vivia aqui y
// confiaba en el primer valor de x-forwarded-for (falsificable por el cliente).
export { getClientIp } from "@/lib/security/client-ip";
