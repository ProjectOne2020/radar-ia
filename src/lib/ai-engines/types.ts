export type EngineName = "openai" | "anthropic" | "gemini" | "perplexity" | "bing_copilot";

export interface EngineRunResult {
  engine: EngineName;
  raw: string;
  citedUrls: string[];
}

export interface EngineSkipped {
  engine: EngineName;
  reason: string;
}

export type EngineOutcome = EngineRunResult | EngineSkipped;

export function isSkipped(outcome: EngineOutcome): outcome is EngineSkipped {
  return !("raw" in outcome);
}
