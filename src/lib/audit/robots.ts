import { AI_CRAWLERS, type AiCrawler, type AuditFindingDraft } from "./types";

interface RobotsRule {
  allow: boolean;
  path: string;
}

type RobotsGroups = Map<string, RobotsRule[]>;

// Parser minimo de robots.txt: agrupa reglas por User-agent (case-insensitive), soporta
// multiples User-agent seguidos del mismo bloque de reglas (sintaxis estandar).
function parseRobotsTxt(raw: string): RobotsGroups {
  const groups: RobotsGroups = new Map();
  let currentAgents: string[] = [];
  let sawRuleSinceLastAgent = false;

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;

    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      if (sawRuleSinceLastAgent) {
        // Nuevo grupo: la siguiente racha de User-agent inicia un bloque distinto.
        currentAgents = [];
        sawRuleSinceLastAgent = false;
      }
      currentAgents.push(value.toLowerCase());
      if (!groups.has(value.toLowerCase())) groups.set(value.toLowerCase(), []);
      continue;
    }

    if ((key === "disallow" || key === "allow") && currentAgents.length > 0) {
      sawRuleSinceLastAgent = true;
      for (const agent of currentAgents) {
        groups.get(agent)?.push({ allow: key === "allow", path: value });
      }
    }
  }

  return groups;
}

// Un bot usa su propio grupo si existe; si no, cae al grupo "*" (comportamiento estandar).
function isBlocked(groups: RobotsGroups, botName: string): boolean {
  const specific = groups.get(botName.toLowerCase());
  const rules = specific && specific.length > 0 ? specific : groups.get("*");
  if (!rules || rules.length === 0) return false;

  // El pilar 3 trata esto como binario (bloqueado = todo el sitio, no gradual por ruta).
  // Disallow: / bloquea todo salvo que exista un Allow: / mas especifico (misma prioridad,
  // se interpreta Allow como excepcion explicita, comportamiento conservador).
  const blocksRoot = rules.some((r) => !r.allow && (r.path === "/" || r.path === ""));
  const allowsRoot = rules.some((r) => r.allow && r.path === "/");
  return blocksRoot && !allowsRoot;
}

export interface RobotsAuditResult {
  fetched: boolean;
  blockedBots: AiCrawler[];
  findings: AuditFindingDraft[];
}

export async function auditRobotsTxt(websiteUrl: string): Promise<RobotsAuditResult> {
  const robotsUrl = new URL("/robots.txt", websiteUrl).toString();

  let raw: string;
  try {
    const res = await fetch(robotsUrl, { headers: { "User-Agent": "RadarIA-Audit/1.0" } });
    if (!res.ok) {
      // Sin robots.txt = nada bloqueado explicitamente (comportamiento estandar por defecto).
      return {
        fetched: false,
        blockedBots: [],
        findings: [
          {
            pillar: 3,
            finding: "El sitio no tiene robots.txt (o no responde) — no bloquea crawlers de IA por defecto.",
            severity: "info",
            detail_locked: false,
          },
        ],
      };
    }
    raw = await res.text();
  } catch (err) {
    return {
      fetched: false,
      blockedBots: [],
      findings: [
        {
          pillar: 3,
          finding: `No se pudo obtener robots.txt: ${err instanceof Error ? err.message : String(err)}`,
          severity: "warning",
          detail_locked: false,
        },
      ],
    };
  }

  const groups = parseRobotsTxt(raw);
  const blockedBots = AI_CRAWLERS.filter((bot) => isBlocked(groups, bot));

  const findings: AuditFindingDraft[] = [];

  // Hallazgo de alto nivel (visible en auditoria gratis) — nunca dice cuales bots exactos.
  findings.push({
    pillar: 3,
    finding:
      blockedBots.length > 0
        ? "El sitio bloquea el acceso de uno o mas motores de IA en robots.txt."
        : "El sitio permite el acceso de los motores de IA verificados en robots.txt.",
    severity: blockedBots.length > 0 ? "critical" : "info",
    detail_locked: false,
  });

  // Detalle accionable (solo plan pagado): que bot exacto esta bloqueado.
  for (const bot of blockedBots) {
    findings.push({
      pillar: 3,
      finding: `robots.txt bloquea a ${bot}.`,
      severity: "critical",
      detail_locked: true,
    });
  }

  return { fetched: true, blockedBots, findings };
}
