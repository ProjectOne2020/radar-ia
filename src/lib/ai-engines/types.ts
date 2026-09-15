// Union de motores para los que existe un adaptador en el repo. NO es la lista de lo que
// el producto mide: eso lo define ACTIVE_ENGINES mas abajo — hoy son CUATRO motores reales:
// OpenAI, Anthropic, Gemini y Perplexity (P0.3, sep 2026).
//
// bing_copilot deliberadamente NO esta aqui: la API de citas reales de Copilot (AI
// Performance) no tiene acceso programatico (confirmado en vivo, agosto 2026). Preferimos
// medir el pilar 8 con menos motores reales que inflar la cifra con una aproximacion.
// La señal de indexacion de Bing vive en el pilar 3 (ver src/lib/audit/bing-indexation.ts).
export type EngineName = "openai" | "anthropic" | "gemini" | "perplexity";

// P0.1 — Motores ACTIVOS del producto, en un solo lugar.
//
// P0.3 (sep 2026) — Perplexity vuelve a la base de medicion: el fundador confirmo credito
// cargado en PERPLEXITY_API_KEY, y perplexity.ts se reescribio contra la Agent API (no la
// Chat Completions deprecada el 27/09/2026) — ver el comentario de cabecera de ese archivo
// para el detalle tecnico completo de la migracion.
//
// Esta constante es la fuente unica: la usa el motor de medicion para decidir a quien
// llamar, y debe usarse para cualquier texto de cara al cliente que enumere motores. Asi
// es imposible que una pantalla prometa un motor que no corre (el defecto que la auditoria
// encontro en Terminos y en la pantalla de escaneo, antes de P0.1).
export const ACTIVE_ENGINES = [
  "openai",
  "anthropic",
  "gemini",
  "perplexity",
] as const satisfies readonly EngineName[];

export type ActiveEngine = (typeof ACTIVE_ENGINES)[number];

export interface Citation {
  url: string;
  // Algunos motores (ej. Gemini) devuelven un link de redirect propio en vez de la URL
  // real citada; cuando el motor sí sabe el dominio real, viaja aqui para no tener que
  // adivinarlo parseando el hostname del link de redirect.
  domainHint?: string;
}

export interface EngineRunResult {
  engine: EngineName;
  raw: string;
  citations: Citation[];

  // P0.2-B — Metadatos de reproducibilidad. Opcionales para no romper a ningun adaptador,
  // pero los tres motores ACTIVOS los rellenan.
  //
  // `modelResolved` es el mas importante y el que casi todo el mundo omite: las tres APIs
  // devuelven en la respuesta el modelo que REALMENTE contesto. Un alias como
  // "gemini-flash-latest" apunta a pesos distintos con el tiempo, asi que sin este campo el
  // hecho de que el motor cambiara bajo nuestros pies seria indetectable — y una caida de
  // score se le atribuiria al cliente en vez de al proveedor.
  provider?: string;
  modelRequested?: string;
  modelResolved?: string;
  requestConfig?: Record<string, unknown>;
}

export interface EngineSkipped {
  engine: EngineName;
  reason: string;
}

export type EngineOutcome = EngineRunResult | EngineSkipped;

export function isSkipped(outcome: EngineOutcome): outcome is EngineSkipped {
  return !("raw" in outcome);
}
