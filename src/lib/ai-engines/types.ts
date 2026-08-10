// bing_copilot deliberadamente NO esta aqui: la API de citas reales de Copilot (AI
// Performance) no tiene acceso programatico (confirmado en vivo, agosto 2026) — el
// producto mide el pilar 8 con 4 motores reales, no 5 forzados con una aproximacion.
// La señal de indexacion de Bing vive en el pilar 3 (ver src/lib/audit/bing-indexation.ts).
export type EngineName = "openai" | "anthropic" | "gemini" | "perplexity";

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
