import type { AuditFindingDraft } from "./types";
import type { JsonLdEntity } from "./schema";

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

interface LocationRow {
  name: string;
  phone: string | null;
  address: string | null;
}

// Compara telefono/direccion declarados en el schema.org del sitio contra lo que el
// cliente registro en `locations`. No es "toda la web coincide" (eso requeriria escanear
// directorios uno por uno, fuera de alcance de M3) — es la fuente propia vs. lo declarado.
export function auditNapConsistency(entities: JsonLdEntity[], location: LocationRow): AuditFindingDraft[] {
  const findings: AuditFindingDraft[] = [];

  const businessEntities = entities.filter((e) =>
    e.type.some((t) => ["Organization", "LocalBusiness", "Dentist", "MedicalBusiness"].includes(t))
  );

  if (businessEntities.length === 0) {
    findings.push({
      pillar: 1,
      finding: "No se encontro un schema de negocio (Organization/LocalBusiness) para verificar NAP contra el sitio.",
      severity: "info",
      detail_locked: true,
    });
    return findings;
  }

  const schemaPhone = businessEntities
    .map((e) => e.raw["telephone"])
    .find((p): p is string => typeof p === "string");

  if (location.phone && schemaPhone) {
    const matches = normalizePhone(location.phone) === normalizePhone(schemaPhone);
    findings.push({
      pillar: 1,
      finding: matches
        ? `El telefono en el schema del sitio coincide con el registrado para "${location.name}".`
        : `El telefono en el schema del sitio (${schemaPhone}) no coincide con el registrado para "${location.name}" (${location.phone}).`,
      severity: matches ? "info" : "critical",
      detail_locked: !matches, // el detalle exacto de la discrepancia es de pago
    });
  } else if (location.phone && !schemaPhone) {
    findings.push({
      pillar: 1,
      finding: `El schema del sitio no declara telefono para "${location.name}".`,
      severity: "warning",
      detail_locked: true,
    });
  }

  return findings;
}
