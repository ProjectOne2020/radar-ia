import type { AuditFindingDraft } from "@/lib/audit/types";
import { extractJsonLd } from "@/lib/audit/schema";

// M16 — pilar 4 variante "apps" (8%): schema.org SoftwareApplication en la landing page
// de la app, sustituye Organization->LocalBusiness (local) o Product->Offer (e-commerce)
// (02-METODOLOGIA-SCORING.md). Campos esperados: operatingSystem y applicationCategory —
// son los que motores de IA usan para desambiguar "esto es una app, no un negocio local".
export function auditAppSchema(html: string, fetched: boolean): AuditFindingDraft[] {
  if (!fetched) {
    return [
      {
        pillar: 4,
        finding: "No se pudo obtener el HTML de la landing page de la app para revisar schema SoftwareApplication.",
        severity: "warning",
        detail_locked: false,
      },
    ];
  }

  const entities = extractJsonLd(html);
  const appNode = entities.find((e) => e.type.includes("SoftwareApplication") || e.type.includes("MobileApplication"));

  if (!appNode) {
    return [
      {
        pillar: 4,
        finding: "La landing page de la app no declara schema SoftwareApplication ni MobileApplication.",
        severity: "warning",
        detail_locked: false,
      },
    ];
  }

  const raw = appNode.raw;
  const missing: string[] = [];
  if (!raw.operatingSystem) missing.push("operatingSystem");
  if (!raw.applicationCategory) missing.push("applicationCategory");

  return [
    {
      pillar: 4,
      finding:
        missing.length === 0
          ? "La landing page de la app declara SoftwareApplication con operatingSystem y applicationCategory."
          : `La landing page de la app declara SoftwareApplication pero le falta: ${missing.join(", ")}.`,
      severity: missing.length === 0 ? "info" : "warning",
      detail_locked: false,
    },
  ];
}
