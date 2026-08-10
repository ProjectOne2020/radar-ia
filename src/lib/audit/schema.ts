import type { AuditFindingDraft } from "./types";

export interface JsonLdEntity {
  type: string[];
  raw: Record<string, unknown>;
}

export interface RawHtmlFetch {
  fetched: boolean;
  html: string;
}

// Fetch de HTML crudo (no una version pre-procesada) — 02-METODOLOGIA-SCORING.md es
// explicito en que el HTML renderizado puede diferir del fuente, pero para JSON-LD y
// robots.txt el codigo fuente crudo es lo que hace falta.
export async function fetchRawHtml(url: string): Promise<RawHtmlFetch> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "RadarIA-Audit/1.0" } });
    if (!res.ok) return { fetched: false, html: "" };
    return { fetched: true, html: await res.text() };
  } catch {
    return { fetched: false, html: "" };
  }
}

function normalizeTypes(type: unknown): string[] {
  if (typeof type === "string") return [type];
  if (Array.isArray(type)) return type.filter((t): t is string => typeof t === "string");
  return [];
}

// Extrae todos los bloques <script type="application/ld+json">, incluyendo arrays y @graph.
export function extractJsonLd(html: string): JsonLdEntity[] {
  const entities: JsonLdEntity[] = [];
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[1].trim());
    } catch {
      continue; // JSON-LD malformado — se ignora ese bloque, no se rompe el resto.
    }

    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    for (const node of nodes) {
      if (node && typeof node === "object") {
        const obj = node as Record<string, unknown>;
        if (Array.isArray(obj["@graph"])) {
          for (const graphNode of obj["@graph"] as Record<string, unknown>[]) {
            entities.push({ type: normalizeTypes(graphNode["@type"]), raw: graphNode });
          }
        } else {
          entities.push({ type: normalizeTypes(obj["@type"]), raw: obj });
        }
      }
    }
  }

  return entities;
}

const EXPECTED_LOCAL_TYPES = ["Organization", "LocalBusiness"];

export function auditSchema(html: string, fetched: boolean): AuditFindingDraft[] {
  if (!fetched) {
    return [
      {
        pillar: 3,
        finding: "No se pudo obtener el HTML del sitio para revisar datos estructurados.",
        severity: "warning",
        detail_locked: false,
      },
    ];
  }

  const entities = extractJsonLd(html);
  const findings: AuditFindingDraft[] = [];

  if (entities.length === 0) {
    findings.push({
      pillar: 3,
      finding: "El sitio no tiene datos estructurados (JSON-LD) — util para desambiguacion, peso menor en el score.",
      severity: "warning",
      detail_locked: false,
    });
    return findings;
  }

  const foundTypes = new Set(entities.flatMap((e) => e.type));
  const hasLocalBusinessType = EXPECTED_LOCAL_TYPES.some((t) => foundTypes.has(t));

  findings.push({
    pillar: 3,
    finding: hasLocalBusinessType
      ? "El sitio tiene datos estructurados de Organization/LocalBusiness."
      : "El sitio tiene JSON-LD pero no declara Organization ni LocalBusiness.",
    severity: hasLocalBusinessType ? "info" : "warning",
    detail_locked: false,
  });

  findings.push({
    pillar: 3,
    finding: `Tipos de schema.org detectados: ${Array.from(foundTypes).join(", ") || "ninguno"}.`,
    severity: "info",
    detail_locked: true,
  });

  // Pilar 4 (estructura semantica): jerarquia Organization -> LocalBusiness -> Servicios.
  const hasService = foundTypes.has("Service") || foundTypes.has("Product") || foundTypes.has("Offer");
  findings.push({
    pillar: 4,
    finding: hasService
      ? "El sitio declara servicios/productos en su schema (Service/Product/Offer)."
      : "El sitio no declara servicios ni productos en su schema estructurado.",
    severity: hasService ? "info" : "warning",
    detail_locked: true,
  });

  return findings;
}
