// Union de motores para los que existe un adaptador en el repo. NO es la lista de lo que
// el producto mide: eso lo define ACTIVE_ENGINES mas abajo, que hoy son TRES motores
// reales — OpenAI, Anthropic y Gemini. `perplexity` sigue en la union porque su adaptador
// existe (perplexity.ts), pero no se llama ni se anuncia en ninguna pantalla.
//
// bing_copilot deliberadamente NO esta aqui: la API de citas reales de Copilot (AI
// Performance) no tiene acceso programatico (confirmado en vivo, agosto 2026). Preferimos
// medir el pilar 8 con menos motores reales que inflar la cifra con una aproximacion.
// La señal de indexacion de Bing vive en el pilar 3 (ver src/lib/audit/bing-indexation.ts).
export type EngineName = "openai" | "anthropic" | "gemini" | "perplexity";

// P0.1 — Motores ACTIVOS del producto, en un solo lugar.
//
// Decision del fundador (Fase 0): la base de medicion es de 3 motores. Perplexity queda
// fuera por dos razones documentadas: (1) `PERPLEXITY_API_KEY` nunca tuvo credito, y
// (2) el endpoint que implementa perplexity.ts (`/chat/completions`, modelo `sonar`) esta
// deprecado por el proveedor con soporte hasta el 27 de septiembre de 2026 — migrarlo
// ahora seria trabajo tirado.
//
// Esta constante es la fuente unica: la usa el motor de medicion para decidir a quien
// llamar, y debe usarse para cualquier texto de cara al cliente que enumere motores. Asi
// es imposible que una pantalla prometa un motor que no corre (el defecto que la auditoria
// encontro en Terminos y en la pantalla de escaneo).
export const ACTIVE_ENGINES = ["openai", "anthropic", "gemini"] as const satisfies readonly EngineName[];

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
}

export interface EngineSkipped {
  engine: EngineName;
  reason: string;
}

export type EngineOutcome = EngineRunResult | EngineSkipped;

export function isSkipped(outcome: EngineOutcome): outcome is EngineSkipped {
  return !("raw" in outcome);
}
