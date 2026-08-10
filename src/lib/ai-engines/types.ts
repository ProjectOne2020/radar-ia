export type EngineName = "openai" | "anthropic" | "gemini" | "perplexity" | "bing_copilot";

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
