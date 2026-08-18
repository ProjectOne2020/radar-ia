import type {
  ContentImportValidation,
  ImportFaq,
  ImportJsonLdBlock,
  ImportLanding,
} from "./types";

// Tipos de schema.org que reconocemos para el bloque jsonLd del import — mismo universo
// que ya audita src/lib/audit/schema.ts (Organization/LocalBusiness para negocios locales,
// Product/Offer/Service para e-commerce, mas FAQPage porque Antigravity genera FAQs).
const RECOGNIZED_JSONLD_TYPES = new Set([
  "Organization",
  "LocalBusiness",
  "Product",
  "Offer",
  "Service",
  "FAQPage",
  "Question",
  "Answer",
]);

// Validacion determinista del formato — no se acepta contenido a medias silenciosamente,
// cada error se reporta explicito (misma disciplina que el resto del proyecto: nunca
// fabricar exito).
export function validateImportPayload(raw: unknown): ContentImportValidation {
  const errors: string[] = [];

  if (typeof raw !== "object" || raw === null) {
    return { valid: false, errors: ["El contenido no es un objeto JSON válido."], payload: null };
  }

  const obj = raw as Record<string, unknown>;

  const faqs: ImportFaq[] = [];
  if (obj.faqs !== undefined) {
    if (!Array.isArray(obj.faqs)) {
      errors.push('"faqs" debe ser un array.');
    } else {
      obj.faqs.forEach((item, i) => {
        if (
          typeof item !== "object" ||
          item === null ||
          typeof (item as Record<string, unknown>).question !== "string" ||
          typeof (item as Record<string, unknown>).answer !== "string" ||
          !(item as Record<string, unknown>).question ||
          !(item as Record<string, unknown>).answer
        ) {
          errors.push(`faqs[${i}] debe tener "question" y "answer" como strings no vacíos.`);
          return;
        }
        faqs.push({
          question: (item as Record<string, unknown>).question as string,
          answer: (item as Record<string, unknown>).answer as string,
        });
      });
    }
  }

  const jsonLd: ImportJsonLdBlock[] = [];
  if (obj.jsonLd !== undefined) {
    if (!Array.isArray(obj.jsonLd)) {
      errors.push('"jsonLd" debe ser un array.');
    } else {
      obj.jsonLd.forEach((item, i) => {
        if (typeof item !== "object" || item === null) {
          errors.push(`jsonLd[${i}] debe ser un objeto.`);
          return;
        }
        const block = item as ImportJsonLdBlock;
        const type = block["@type"];
        if (typeof type !== "string" || !RECOGNIZED_JSONLD_TYPES.has(type)) {
          errors.push(
            `jsonLd[${i}] tiene "@type" no reconocido (${String(type)}) — tipos válidos: ${Array.from(RECOGNIZED_JSONLD_TYPES).join(", ")}.`
          );
          return;
        }
        jsonLd.push(block);
      });
    }
  }

  let landing: ImportLanding | null = null;
  if (obj.landing !== undefined && obj.landing !== null) {
    const l = obj.landing as Record<string, unknown>;
    if (
      typeof l.title !== "string" ||
      typeof l.description !== "string" ||
      !Array.isArray(l.sections) ||
      !l.sections.every(
        (s) =>
          typeof s === "object" &&
          s !== null &&
          typeof (s as Record<string, unknown>).heading === "string" &&
          typeof (s as Record<string, unknown>).body === "string"
      )
    ) {
      errors.push('"landing" debe tener title (string), description (string) y sections (array de {heading, body}).');
    } else {
      landing = {
        title: l.title as string,
        description: l.description as string,
        sections: l.sections as ImportLanding["sections"],
      };
    }
  }

  if (faqs.length === 0 && jsonLd.length === 0 && !landing) {
    errors.push("El archivo no tiene ningún contenido válido (faqs, jsonLd o landing).");
  }

  // Todo o nada: si algo del archivo no valida, no se aplica nada — mas facil de razonar
  // que un import parcial, y fuerza a corregir el archivo de origen en vez de dejar
  // contenido a medias en prompt_sets.
  if (errors.length > 0) {
    return { valid: false, errors, payload: null };
  }

  return { valid: true, errors: [], payload: { faqs, jsonLd, landing } };
}
