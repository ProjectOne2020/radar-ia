export type Severity = "critical" | "warning" | "info";

// Espejo de audit_findings sin id/audited_at (los pone la DB). pillar es 1-8 por el
// esquema (03-ARQUITECTURA-TECNICA.md); M3 hoy solo escribe en 1, 2, 3, 4 y 7 (reseñas,
// via GBP nivel 1) — 5, 6 y 8 se llenan desde otros modulos (M2 para 6/8; 5 pendiente).
export interface AuditFindingDraft {
  pillar: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  finding: string;
  severity: Severity;
  detail_locked: boolean;
}

// Los seis crawlers de IA que 03-ARQUITECTURA-TECNICA.md pide verificar en robots.txt.
export const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
] as const;

export type AiCrawler = (typeof AI_CRAWLERS)[number];
