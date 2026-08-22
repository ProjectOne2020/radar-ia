// P0.1 — Normalizacion y tokenizacion compartida por todo el clasificador.
//
// Regla central de este archivo: NUNCA se compara por substring cruda. El bug historico
// que motivo P0.1 (cliente "Sol" matcheando dentro de "solucion") viene exactamente de
// `texto.includes(nombre)`. Aqui todo se compara por TOKENS con limites de palabra.

/**
 * minusculas, sin diacriticos, sin puntuacion, espacios colapsados.
 * "Clínica Dental Sonrisa, S.A." -> "clinica dental sonrisa s a"
 */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Igual que normalizeText pero ademas quita puntos y guiones (para tokens de nombre). */
export function normalizeName(value: string): string {
  return normalizeText(value).replace(/[.-]/g, " ").replace(/\s+/g, " ").trim();
}

export function tokenize(value: string): string[] {
  const n = normalizeName(value);
  return n ? n.split(" ").filter(Boolean) : [];
}

/**
 * Coincidencia por secuencia de tokens (no substring). Devuelve true solo si TODOS los
 * tokens de `needle` aparecen consecutivos y completos dentro de `haystackTokens`.
 *
 * Esto es lo que impide que "sol" matchee dentro de "solucion": "solucion" es un token
 * distinto de "sol", no una coincidencia parcial.
 */
export function containsTokenSequence(haystackTokens: string[], needle: string): boolean {
  const needleTokens = tokenize(needle);
  if (needleTokens.length === 0) return false;
  if (needleTokens.length > haystackTokens.length) return false;

  for (let i = 0; i <= haystackTokens.length - needleTokens.length; i++) {
    let all = true;
    for (let j = 0; j < needleTokens.length; j++) {
      if (haystackTokens[i + j] !== needleTokens[j]) {
        all = false;
        break;
      }
    }
    if (all) return true;
  }
  return false;
}

/**
 * Todos los tokens de `needle` aparecen en el texto, en cualquier orden y sin ser
 * necesariamente contiguos.
 *
 * Este es el detector de COLISION SEMANTICA del caso "Farmacia Guadalajara" vs
 * "¿que farmacia recomiendan en Guadalajara?": ningun token por separado prueba identidad
 * (ambos son genericos), pero que el prompt contenga el nombre COMPLETO del negocio
 * disperso significa que, en la practica, el prompt ya nombra al cliente. Tratarlo como
 * pregunta ciega inflaria la TAO exactamente como hacia v1.
 */
export function containsAllTokensScattered(haystackTokens: string[], needle: string): boolean {
  const needleTokens = tokenize(needle);
  if (needleTokens.length === 0) return false;
  const set = new Set(haystackTokens);
  return needleTokens.every((t) => set.has(t));
}

/**
 * Extrae candidatos a dominio del texto crudo (antes de normalizar, para no perder puntos).
 * Cubre las formas del pedido: example.com, www.example.com, https://example.com,
 * example.com.mx, sub.example.com
 */
export function extractDomainCandidates(rawText: string): string[] {
  const re = /\b(?:https?:\/\/)?(?:www\.)?((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})(?:\/[^\s]*)?/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(rawText)) !== null) {
    const host = m[1].toLowerCase().replace(/\.$/, "");
    // Descarta cosas como "S.A" o numeros con punto que no son dominios reales.
    if (!/\.[a-z]{2,}$/.test(host)) continue;
    out.push(host);
  }
  return out;
}

/**
 * Etiqueta base registrable aproximada: "sub.example.com.mx" -> "example".
 *
 * Aproximacion deliberada (no usamos la Public Suffix List completa para no meter una
 * dependencia nueva en P0.1): se toma la etiqueta anterior al sufijo, saltando sufijos
 * compuestos comunes de LATAM. Es intencionalmente PERMISIVA — en caso de duda prefiere
 * marcar contaminacion, porque un falso "domain_seeded" solo pierde una pregunta,
 * mientras que un falso "clean_blind" contamina la metrica del producto.
 */
const COMPOUND_SUFFIXES = new Set([
  "com", "net", "org", "gob", "edu", "co", "ind", "nom", "web", "info", "biz",
]);

export function domainBaseLabel(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  // ultimo = TLD. si el penultimo es un sufijo compuesto (.com.mx), la base es el anterior.
  const maybeCompound = parts[parts.length - 2];
  if (parts.length >= 3 && COMPOUND_SUFFIXES.has(maybeCompound)) {
    return parts[parts.length - 3];
  }
  return maybeCompound;
}
