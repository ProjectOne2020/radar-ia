import { isBrandRecognitionClass, isTaoEligibleClass } from "@/lib/prompt-class/types";

// P0.1 — Tasa de Aparicion Organica (TAO) y Reconocimiento de Marca.
//
// ===========================================================================
// LA GARANTIA ESTRUCTURAL
// ===========================================================================
// La regla central de P0.1 es: "un run que no sea clean_blind NO puede contribuir a TAO,
// nunca". El fundador pidio explicitamente que esa garantia NO dependa de que un
// desarrollador recuerde poner un filtro.
//
// Se implementa con un tipo opaco (branded type): `TaoObservation` lleva un simbolo
// privado que este modulo es el unico capaz de producir. `computeTao()` acepta
// EXCLUSIVAMENTE ese tipo. La unica forma de fabricar uno es `toTaoObservation()`, que
// devuelve null si el run no pasa la compuerta.
//
// Consecuencia: pasarle un run contaminado a computeTao() no es un bug que haya que
// recordar evitar — es un error de compilacion de TypeScript. La proteccion vive en el
// sistema de tipos, no en la disciplina de quien escribe el codigo.
// ===========================================================================

declare const TAO_BRAND: unique symbol;

export interface TaoObservation {
  readonly [TAO_BRAND]: true;
  readonly promptId: string | null;
  readonly mentioned: boolean;
}

/** Forma minima de un run tal como vive hoy en `tracking_runs`. */
export interface RunLike {
  prompt_id: string | null;
  mentioned: boolean;
  prompt_class: string | null;
  /**
   * Como se decidio `mentioned`. Si la clasificacion cayo al fallback de substring porque
   * Groq fallo, el dato NO es confiable y queda fuera de TAO (reduce cobertura, no cuenta
   * como ausencia). Es la parte de "ERROR != ABSENT" que corresponde a P0.1.
   */
  mention_method?: string | null;
}

/**
 * Unica puerta de entrada a TAO. Devuelve null — nunca lanza, nunca adivina — cuando el
 * run no es admisible. Cada rechazo es silencioso a proposito: el llamador cuenta los
 * nulls como perdida de COBERTURA, no como ausencia del negocio.
 */
export function toTaoObservation(run: RunLike): TaoObservation | null {
  // 1. Clase de prompt. null/desconocida => NO elegible (fail-safe para el historico).
  if (!isTaoEligibleClass(run.prompt_class)) return null;

  // 2. Clasificacion degradada => fuera. "Ni por fallback. Ni por substring." (regla central)
  //
  // ---------------------------------------------------------------------------------
  // ASIMETRIA DELIBERADA EN EL FAIL-SAFE — leer antes de "corregir" esta linea.
  //
  // Las dos comprobaciones tratan el NULL de forma OPUESTA, y es a proposito:
  //
  //   prompt_class    NULL => EXCLUIDO   (estricto)
  //   mention_method  NULL => ADMITIDO   (permisivo)
  //
  // El motivo es que NULL significa cosas distintas en cada columna:
  //
  //   - `prompt_class` NULL = no sabemos si el prompt estaba contaminado. Admitirlo
  //     reabriria justo el agujero que P0.1 cierra, asi que se excluye siempre.
  //
  //   - `mention_method` NULL = el run es anterior a P0.1, cuando la columna no existia.
  //     No es "metodo desconocido y sospechoso": en esa epoca `GROQ_API_KEY` ya estaba
  //     configurada, asi que classifyMention usaba el clasificador LLM salvo caida puntual
  //     de Groq. Excluirlos dejaria la TAO en null para TODOS los clientes actuales hasta
  //     la proxima medicion, borrando de la vista datos que si son utilizables.
  //
  // Riesgo aceptado y acotado: un run historico concreto que SI cayo al substring queda
  // hoy indistinguible y puede entrar a la muestra. Afecta unicamente a los 51 runs
  // previos a P0.1; todo run nuevo escribe siempre 'llm' o 'substring_fallback' explicito,
  // asi que la ambiguedad no crece y se extingue sola.
  //
  // Cuando P0.2 introduzca measurement_sessions, los runs sin sesion (= los historicos)
  // quedaran fuera de la ventana temporal y esta excepcion dejara de tener efecto. En ese
  // momento se puede endurecer a `run.mention_method !== "llm"` sin perder nada.
  // ---------------------------------------------------------------------------------
  if (run.mention_method === "substring_fallback") return null;

  // La marca es puramente de tipos (`declare const` no existe en runtime). Este `as` es
  // el UNICO punto del sistema autorizado a producir un TaoObservation, y esta despues de
  // la compuerta de arriba — por eso la garantia se sostiene.
  return { promptId: run.prompt_id, mentioned: run.mentioned } as unknown as TaoObservation;
}

export interface TaoResult {
  /** Proporcion 0-100 sobre observaciones admisibles. null si no hay muestra. */
  rate: number | null;
  /** Numerador: observaciones con aparicion. */
  appearances: number;
  /** Denominador: observaciones admisibles (runs clean_blind no degradados). */
  sampleRuns: number;
  /** Preguntas distintas involucradas — el n honesto para hablar de muestra. */
  samplePrompts: number;
  /** Preguntas distintas en las que aparecio en al menos un motor. */
  promptsWithAppearance: number;
  /** Runs descartados por no ser admisibles. Es COBERTURA PERDIDA, no ausencia. */
  excludedRuns: number;
}

/**
 * Calcula la TAO. Solo acepta observaciones ya validadas por `toTaoObservation`.
 * No hay forma de invocarla con datos contaminados sin romper la compilacion.
 */
export function computeTao(observations: TaoObservation[], excludedRuns = 0): TaoResult {
  const sampleRuns = observations.length;
  const appearances = observations.filter((o) => o.mentioned).length;

  const byPrompt = new Map<string, boolean>();
  for (const o of observations) {
    const key = o.promptId ?? "__sin_prompt__";
    byPrompt.set(key, (byPrompt.get(key) ?? false) || o.mentioned);
  }

  return {
    rate: sampleRuns === 0 ? null : (appearances / sampleRuns) * 100,
    appearances,
    sampleRuns,
    samplePrompts: byPrompt.size,
    promptsWithAppearance: [...byPrompt.values()].filter(Boolean).length,
    excludedRuns,
  };
}

/**
 * Atajo para el caso normal: filtra una lista cruda de runs y calcula la TAO,
 * contabilizando correctamente los descartes como cobertura perdida.
 */
export function computeTaoFromRuns(runs: RunLike[]): TaoResult {
  const observations: TaoObservation[] = [];
  let excluded = 0;
  for (const run of runs) {
    const obs = toTaoObservation(run);
    if (obs) observations.push(obs);
    else excluded += 1;
  }
  return computeTao(observations, excluded);
}

// ---------------------------------------------------------------------------
// RECONOCIMIENTO DE MARCA — metrica SEPARADA, nunca promediada con TAO.
//
// Mide algo distinto y mucho menos exigente: cuando al motor se le da el nombre, ¿lo
// reconoce? Las preguntas con nombre producen mencion casi por construccion (datos reales
// de la auditoria: 94.4% con nombre vs 0.0% sin nombre para el mismo negocio), por eso
// mezclarlas con TAO era el defecto que P0.1 corrige.
// ---------------------------------------------------------------------------
export interface BrandRecognitionResult {
  rate: number | null;
  appearances: number;
  sampleRuns: number;
  samplePrompts: number;
}

export function computeBrandRecognition(runs: RunLike[]): BrandRecognitionResult {
  const eligible = runs.filter(
    (r) => isBrandRecognitionClass(r.prompt_class) && r.mention_method !== "substring_fallback",
  );
  const appearances = eligible.filter((r) => r.mentioned).length;
  const prompts = new Set(eligible.map((r) => r.prompt_id ?? "__sin_prompt__"));

  return {
    rate: eligible.length === 0 ? null : (appearances / eligible.length) * 100,
    appearances,
    sampleRuns: eligible.length,
    samplePrompts: prompts.size,
  };
}
