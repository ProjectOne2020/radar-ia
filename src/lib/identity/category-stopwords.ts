import { RUBROS } from "@/lib/question-bank/taxonomy";
import { tokenize } from "./normalize";
import type { VariantSource } from "./types";

// P0.1 — Tokens que NO prueban identidad.
//
// El fundador pidio explicitamente que esto NO sea "una lista arbitraria enorme". El
// mecanismo tiene tres fuentes, en orden de precedencia, y esta pensado para crecer sin
// que nadie tenga que mantener un diccionario a mano:
//
//   1. DERIVADA de la taxonomia que ya existe (`RUBROS` en question-bank/taxonomy.ts).
//      Los 43 rubros ya contienen las palabras de categoria del negocio ("dental",
//      "farmacia", "veterinaria", ...). Si manana se agrega un rubro nuevo, sus palabras
//      entran solas aqui — cero mantenimiento duplicado.
//   2. DERIVADA del propio `clients.niche` del cliente (texto libre desde M23). Si alguien
//      escribe "panaderia artesanal", ambos tokens dejan de ser evidencia de identidad
//      PARA ESE CLIENTE.
//   3. SEMILLA MANUAL, abajo: solo palabras estructurales del español comercial que no
//      aparecen en ningun rubro (formas juridicas, conectores, palabras de lugar).
//
// Consecuencia practica: un negocio llamado "Clinica Dental Sonrisa" tiene "clinica" y
// "dental" como stopwords; el unico token que prueba identidad es "sonrisa". Sin esto,
// cualquier prompt del rubro dental matchearia con cualquier clinica dental — el falso
// positivo que la auditoria documento en gbp.ts.

const STRUCTURAL_SEED = [
  // formas juridicas
  "sa", "sas", "srl", "sc", "scp", "cv", "de", "rl", "spa", "ltda", "eirl", "inc", "llc",
  // conectores y articulos
  "el", "la", "los", "las", "del", "y", "e", "o", "u", "en", "con", "por", "para", "al", "a",
  // palabras comerciales genericas
  "grupo", "centro", "casa", "corporativo", "compania", "empresa", "negocio", "servicios",
  "servicio", "soluciones", "solucion", "consultorio", "estudio", "taller", "tienda",
  "comercial", "profesional", "profesionales", "especialistas", "especialista",
  // palabras de lugar (no prueban identidad por si solas)
  "sucursal", "sede", "local", "plaza", "avenida", "calle", "colonia", "zona", "norte",
  "sur", "este", "oeste", "centro",
];

let derivedFromTaxonomyCache: Set<string> | null = null;

function derivedFromTaxonomy(): Set<string> {
  if (derivedFromTaxonomyCache) return derivedFromTaxonomyCache;
  const set = new Set<string>();
  for (const rubro of RUBROS) {
    for (const token of tokenize(rubro.label)) set.add(token);
    for (const token of rubro.slug.split("_")) {
      const t = tokenize(token)[0];
      if (t) set.add(t);
    }
  }
  derivedFromTaxonomyCache = set;
  return set;
}

/**
 * Stopwords de categoria efectivas para un cliente concreto.
 * `niche` es el rubro en texto libre que escribio el propio cliente.
 */
export function categoryStopwordsFor(niche?: string | null): Set<string> {
  const set = new Set<string>(STRUCTURAL_SEED);
  for (const t of derivedFromTaxonomy()) set.add(t);
  if (niche) {
    for (const t of tokenize(niche)) set.add(t);
  }
  return set;
}

// Palabras del español lo bastante comunes como para que un negocio que se llame asi NO
// pueda identificarse por una sola aparicion del token. Es la proteccion pedida para
// nombres tipo "Ideal", "Central", "Progreso", "Sol", "Nova".
//
// Ojo: esto NO impide detectar al cliente — solo exige corroboracion (ver
// classify-prompt.ts). Un prompt con "Farmacia Ideal" sigue detectandose; uno con
// "la solucion ideal" no.
const LOW_ENTROPY_WORDS = new Set([
  "ideal", "central", "progreso", "sol", "nova", "optima", "optimo", "premium", "express",
  "global", "total", "unico", "unica", "nuevo", "nueva", "mejor", "buena", "bueno", "gran",
  "grande", "real", "vida", "salud", "hogar", "familia", "futuro", "moderno", "moderna",
  "clasico", "clasica", "principal", "general", "nacional", "internacional", "regional",
  "nuestro", "nuestra", "primero", "primera", "estrella", "luna", "mar", "rio", "verde",
  "azul", "blanco", "blanca", "dorado", "dorada",
]);

/** Umbral de longitud por debajo del cual un token unico no basta como evidencia. */
const SHORT_TOKEN_MAX_LENGTH = 4;

/**
 * Un nombre es de "baja entropia" si una sola coincidencia suya no alcanza para afirmar
 * que el texto se refiere a ese negocio: un unico token, y ademas corto o una palabra
 * comun del español.
 */
export function isLowEntropyName(name: string): boolean {
  const tokens = tokenize(name);
  if (tokens.length !== 1) return false;
  const t = tokens[0];
  return t.length <= SHORT_TOKEN_MAX_LENGTH || LOW_ENTROPY_WORDS.has(t);
}

/**
 * ¿Una coincidencia de este valor necesita contexto adicional para contar como "el prompt
 * nombra al cliente"?
 *
 * La distincion salio de un test que fallo: un acronimo EXPLICITO como "UANL" es corto
 * (4 letras) pero el cliente lo registro a proposito — exigirle corroboracion lo degradaba
 * a weak_blind y perdiamos una señal legitima. En cambio "Sol" o "Ideal" son palabras
 * comunes del español y ahi la corroboracion es imprescindible, venga de donde venga.
 *
 *   - palabra comun del español  -> SIEMPRE requiere corroboracion (aunque sea explicita)
 *   - token corto y DERIVADO     -> requiere corroboracion (lo dedujimos nosotros)
 *   - token corto y EXPLICITO    -> no la requiere (el cliente lo confirmo)
 */
export function requiresCorroboration(value: string, source: VariantSource): boolean {
  const tokens = tokenize(value);
  if (tokens.length !== 1) return false;
  const t = tokens[0];
  if (LOW_ENTROPY_WORDS.has(t)) return true;
  return source === "derived" && t.length <= SHORT_TOKEN_MAX_LENGTH;
}

/**
 * Tokens del nombre que SI prueban identidad: los que no son stopword de categoria.
 * "Clinica Dental Sonrisa" con rubro dental -> ["sonrisa"]
 * "Farmacia Guadalajara" con rubro farmacia -> ["guadalajara"]  (ver colision semantica)
 */
export function distinctiveTokens(name: string, stopwords: Set<string>): string[] {
  return tokenize(name).filter((t) => !stopwords.has(t));
}
