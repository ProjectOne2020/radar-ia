import type { ClientIdentity, IdentitySignal } from "@/lib/identity/types";
import {
  categoryStopwordsFor,
  distinctiveTokens,
  isLowEntropyName,
  requiresCorroboration,
} from "@/lib/identity/category-stopwords";
import {
  containsAllTokensScattered,
  containsTokenSequence,
  domainBaseLabel,
  extractDomainCandidates,
  tokenize,
} from "@/lib/identity/normalize";
import type { PromptClassification, PromptIntent } from "./types";

// P0.1 — Clasificador DETERMINISTA de contaminacion.
//
// Prohibido usar un LLM aqui (pedido explicito del fundador, §2). La razon de fondo: si un
// modelo decidiera si un prompt nombra al cliente, la garantia central del producto
// dependeria de una inferencia no reproducible, y un fallo del modelo volveria a
// contaminar la TAO — exactamente el problema que P0.1 existe para cerrar.
//
// Sesgo deliberado del clasificador: ante la duda, CONTAMINA. Un falso "weak_blind" solo
// cuesta una pregunta menos en la muestra; un falso "clean_blind" corrompe la metrica que
// le vendemos al cliente. La asimetria de daño no es negociable.

// Marcadores de intencion de categoria. Lista corta a proposito: solo se usa para etiquetar
// `intent`, nunca para decidir contaminacion, asi que un falso negativo aqui es inofensivo.
const CATEGORY_INTENT_MARKERS = [
  "mejor", "mejores", "buena", "buen", "bueno", "recomiendan", "recomienda", "recomendable",
  "cual", "cuales", "donde", "que", "opciones", "opinion", "opiniones", "cuanto", "cuesta",
  "precio", "confianza", "cerca",
];

function detectIntent(promptTokens: string[]): PromptIntent {
  return promptTokens.some((t) => CATEGORY_INTENT_MARKERS.includes(t)) ? "category" : "general";
}

/**
 * Clasifica un prompt contra la identidad del cliente. Puro: sin red, sin base de datos,
 * sin LLM. Mismo input -> mismo output, siempre.
 */
export function classifyPrompt(promptText: string, identity: ClientIdentity): PromptClassification {
  const promptTokens = tokenize(promptText);
  const intent = detectIntent(promptTokens);
  const stopwords = categoryStopwordsFor(identity.niche);
  const signals: IdentitySignal[] = [];

  // --- 1. DOMINIOS -------------------------------------------------------------------
  // Se evalua sobre el texto CRUDO (no normalizado) para no perder los puntos del host.
  const promptDomains = extractDomainCandidates(promptText);
  const clientDomains = identity.variants
    .filter((v) => v.kind === "domain" || v.kind === "alt_domain")
    .map((v) => ({ base: domainBaseLabel(v.value), variant: v }))
    .filter((d) => d.base.length > 0);

  for (const host of promptDomains) {
    const base = domainBaseLabel(host);
    const hit = clientDomains.find((d) => d.base === base);
    if (hit) {
      signals.push({
        kind: hit.variant.kind === "domain" ? "domain" : "alt_domain",
        matched: host,
        source: hit.variant.source,
        lowConfidence: false,
      });
    }
  }

  // --- 2. MARCAS / PRODUCTOS PROPIOS -------------------------------------------------
  for (const v of identity.variants) {
    if (v.kind !== "product_brand") continue;
    if (containsTokenSequence(promptTokens, v.value)) {
      signals.push({
        kind: "product_brand",
        matched: v.value,
        source: v.source,
        lowConfidence: isLowEntropyName(v.value),
      });
    }
  }

  // --- 3. NOMBRES Y VARIANTES --------------------------------------------------------
  const nameCandidates: Array<{ value: string; kind: IdentitySignal["kind"]; source: "explicit" | "derived" }> = [
    { value: identity.tradeName, kind: "trade_name", source: "explicit" },
  ];
  if (identity.legalName) {
    nameCandidates.push({ value: identity.legalName, kind: "legal_name", source: "explicit" });
  }
  for (const v of identity.variants) {
    if (v.kind === "domain" || v.kind === "alt_domain" || v.kind === "product_brand") continue;
    nameCandidates.push({
      value: v.value,
      kind: v.kind === "acronym" ? "acronym" : v.kind === "misspelling" ? "misspelling" : "trade_name",
      source: v.source,
    });
  }

  // Tokens del propio rubro del cliente: son los unicos que sirven para CORROBORAR un
  // nombre de baja entropia. Un token estructural cualquiera no vale — si "solucion"
  // corroborara, el cliente "Ideal" veria "la solucion ideal" como si lo nombraran.
  const corroborationTokens = new Set(tokenize(identity.niche ?? ""));

  for (const cand of nameCandidates) {
    if (!containsTokenSequence(promptTokens, cand.value)) continue;

    if (requiresCorroboration(cand.value, cand.source)) {
      // Nombre corto/generico: exige corroboracion contextual (§5).
      const nameTokens = tokenize(cand.value);
      const idx = promptTokens.findIndex((t) => t === nameTokens[0]);
      const neighbors = [promptTokens[idx - 1], promptTokens[idx + 1]].filter(Boolean);
      const corroborated = neighbors.some((n) => corroborationTokens.has(n));
      signals.push({
        kind: cand.kind,
        matched: cand.value,
        source: cand.source,
        lowConfidence: !corroborated,
      });
      continue;
    }

    signals.push({ kind: cand.kind, matched: cand.value, source: cand.source, lowConfidence: false });
  }

  // --- 4. COLISION SEMANTICA (caso "Farmacia Guadalajara") ---------------------------
  // El nombre completo aparece disperso en el prompt aunque ningun token por separado
  // pruebe identidad. Es el caso que el fundador puso como ejemplo en §3.
  const nameHasDistinctive = distinctiveTokens(identity.tradeName, stopwords).length > 0;
  const alreadyNamed = signals.some((s) => s.kind === "trade_name" && !s.lowConfidence);
  if (!alreadyNamed && containsAllTokensScattered(promptTokens, identity.tradeName)) {
    signals.push({
      kind: "semantic_collision",
      matched: identity.tradeName,
      source: "derived",
      // Si el nombre no tiene ningun token distintivo (es 100% categoria), la colision es
      // aun mas dificil de distinguir de una pregunta generica legitima.
      lowConfidence: !nameHasDistinctive,
    });
  }

  // --- 5. COMPETIDORES ---------------------------------------------------------------
  for (const competitor of identity.competitorNames) {
    const distinctive = distinctiveTokens(competitor, stopwords);
    if (distinctive.length === 0) continue; // nombre de competidor 100% generico: no sirve
    if (containsTokenSequence(promptTokens, competitor)) {
      signals.push({
        kind: "competitor",
        matched: competitor,
        source: "explicit",
        lowConfidence: false,
      });
    }
  }

  // --- VEREDICTO ---------------------------------------------------------------------
  // Precedencia: la señal MAS contaminante gana. Orden fijado por el pedido (§6,7,8).
  const has = (k: IdentitySignal["kind"]) => signals.some((s) => s.kind === k);
  const hasClientSignal = signals.some((s) => s.kind !== "competitor");

  if (has("competitor") && hasClientSignal) {
    return { promptClass: "comparative", intent, signals, rule: "cliente + competidor" };
  }
  if (has("domain") || has("alt_domain")) {
    return { promptClass: "domain_seeded", intent, signals, rule: "dominio del cliente en el prompt" };
  }
  if (has("product_brand")) {
    return { promptClass: "product_seeded", intent, signals, rule: "marca/producto del cliente" };
  }

  const strongName = signals.some(
    (s) => (s.kind === "trade_name" || s.kind === "legal_name" || s.kind === "acronym" || s.kind === "misspelling") && !s.lowConfidence,
  );
  if (strongName) {
    return { promptClass: "named", intent, signals, rule: "nombre o variante conocida" };
  }

  // Cualquier señal restante (baja confianza o colision semantica) contamina pero no
  // alcanza para afirmar que el prompt nombra al cliente.
  if (signals.length > 0) {
    return {
      promptClass: "weak_blind",
      intent,
      signals,
      rule: has("semantic_collision")
        ? "colision semantica nombre+categoria/geografia"
        : "coincidencia de baja confianza sin corroborar",
    };
  }

  return { promptClass: "clean_blind", intent, signals: [], rule: "sin señales de identidad" };
}
