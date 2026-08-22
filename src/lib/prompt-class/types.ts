import type { IdentitySignal } from "@/lib/identity/types";

// P0.1 — Clasificacion de contaminacion de un prompt.
//
// Las 7 clases pedidas por el fundador. IMPORTANTE sobre `category`:
//
// El pedido original define en §2 siete clases, pero luego en §9 dice que una pregunta de
// intencion de categoria sin señales del cliente es "category + clean_blind", mientras que
// el TEST 4 obligatorio exige que exactamente ese tipo de pregunta devuelva `clean_blind`.
// Son dos dimensiones distintas mezcladas en una sola lista:
//
//   - CONTAMINACION (¿el prompt delata al cliente?) -> clean_blind | weak_blind | named |
//     domain_seeded | product_seeded | comparative
//   - INTENCION (¿que tipo de pregunta es?) -> category | general
//
// Se resolvio separandolas: `promptClass` es SIEMPRE el veredicto de contaminacion, y la
// intencion de categoria viaja aparte en `intent`. `category` se mantiene en el tipo por
// compatibilidad con el pedido y por si en P0.2 se quiere persistir, pero el clasificador
// NUNCA lo devuelve como veredicto, y la compuerta de TAO lo excluye — de modo que la
// regla central queda literal y sin ambiguedad: SOLO `clean_blind` contribuye a TAO.
export type PromptClass =
  | "clean_blind"
  | "weak_blind"
  | "named"
  | "domain_seeded"
  | "product_seeded"
  | "comparative"
  | "category";

export type PromptIntent = "category" | "general";

export interface PromptClassification {
  promptClass: PromptClass;
  intent: PromptIntent;
  /** Todas las señales de identidad encontradas. Vacio si y solo si es clean_blind. */
  signals: IdentitySignal[];
  /** Regla determinista que produjo el veredicto — para auditabilidad. */
  rule: string;
}

// ---------------------------------------------------------------------------
// LA COMPUERTA. Este es el unico lugar del sistema autorizado a decidir que clase
// puede alimentar la Tasa de Aparicion Organica.
//
// No agregar clases aqui sin cambiar tambien el test de invariante
// (src/lib/metrics/__tests__/tao-invariant.test.ts), que falla a proposito si esta lista
// crece. La proteccion tiene que estar en el codigo y en el test, no en la documentacion.
// ---------------------------------------------------------------------------
export const TAO_ELIGIBLE_CLASSES = ["clean_blind"] as const satisfies readonly PromptClass[];

export type TaoEligibleClass = (typeof TAO_ELIGIBLE_CLASSES)[number];

export function isTaoEligibleClass(value: string | null | undefined): value is TaoEligibleClass {
  if (!value) return false; // null/undefined (ej. historico sin clasificar) NUNCA es elegible.
  return (TAO_ELIGIBLE_CLASSES as readonly string[]).includes(value);
}

/** Clases que alimentan Reconocimiento de Marca — explicitamente distinto de TAO. */
export const BRAND_RECOGNITION_CLASSES = [
  "named",
  "domain_seeded",
  "product_seeded",
] as const satisfies readonly PromptClass[];

export function isBrandRecognitionClass(value: string | null | undefined): boolean {
  if (!value) return false;
  return (BRAND_RECOGNITION_CLASSES as readonly string[]).includes(value);
}
