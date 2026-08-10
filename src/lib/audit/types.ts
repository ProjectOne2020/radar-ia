export type Severity = "critical" | "warning" | "info";

// Espejo de audit_findings sin id/audited_at (los pone la DB).
export interface AuditFindingDraft {
  pillar: 1 | 2 | 3 | 4;
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
