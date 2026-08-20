import { createAdminClient } from "@/lib/supabase/admin";

// M28 — banco de preguntas nativas por rubro+pais en la tabla `question_bank` (pedido
// explicito del fundador: "las 150 preguntas son el motor de Radar IA", un banco curado
// por combinacion rubro+pais, no traducido del ingles, mucho mas grande que las 4-5
// plantillas a mano de abajo). Cuando existe contenido activo para el rubro+pais exacto
// de esta auditoria, se usa ese banco (con muestreo aleatorio, para que auditorias
// distintas del mismo rubro+pais no repitan siempre las mismas 5 preguntas); si no hay
// banco todavia para esa combinacion, se cae al fallback de CURATED_TEMPLATES/generico
// de mas abajo — nunca deja al cliente sin preguntas mientras el banco se sigue llenando
// pais por pais, rubro por rubro.
export async function buildPromptsFromBank(
  niche: string,
  country: string,
  axis: "local" | "ecommerce" | "app" | undefined,
  city: string,
  limit: number,
): Promise<string[] | null> {
  const admin = createAdminClient();
  const normalized = niche.trim().toLowerCase();
  const categoryType = axis === "app" ? "app" : "vertical";

  const { data } = await admin
    .from("question_bank")
    .select("question_text, rubro, rubro_label")
    .eq("country", country)
    .eq("category_type", categoryType)
    .eq("active", true);

  if (!data || data.length === 0) return null;

  const matched = data.filter(
    (row) => row.rubro.toLowerCase() === normalized || row.rubro_label.toLowerCase() === normalized,
  );
  if (matched.length === 0) return null;

  const shuffled = [...matched].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit).map((row) => row.question_text.replace(/\{city\}/g, city));
}

// Preguntas plantilla para la auditoria gratis (04-MODULOS-CONSTRUCCION.md M6: "5-10
// preguntas, no el set completo de un plan pagado"). No hay ningun modulo dedicado a
// generar prompt_sets por nicho todavia (M15/Antigravity es para contenido completo del
// sitio del cliente, no para esto) — son plantillas curadas a mano, en el mismo tono del
// ejemplo de copy ya validado en 01-CONTEXTO-NEGOCIO.md seccion 7. Ajustables por el
// fundador; no son un peso de scoring ni un precio, son solo el texto de las preguntas.
// A partir de M28, este es el FALLBACK cuando `question_bank` no tiene todavia contenido
// para el rubro+pais exacto — antes era la unica fuente.
const CURATED_TEMPLATES: Record<string, string[]> = {
  dental: [
    "¿Cuál es una buena clínica dental en {city}?",
    "¿Dónde puedo encontrar un dentista de confianza en {city}?",
    "¿Cuánto cuesta una limpieza dental en {city}?",
    "mejores dentistas en {city}",
    "¿Qué clínica dental recomiendan en {city} para ortodoncia?",
  ],
  estetica: [
    "¿Cuál es una buena clínica de estética en {city}?",
    "¿Dónde puedo encontrar un centro de estética de confianza en {city}?",
    "mejores clínicas de estética en {city}",
    "¿Qué clínica de estética recomiendan en {city}?",
    "¿Cuánto cuesta un tratamiento facial en {city}?",
  ],
  inmobiliaria: [
    "¿Cuál es una buena inmobiliaria en {city}?",
    "¿Dónde puedo encontrar un agente inmobiliario de confianza en {city}?",
    "mejores inmobiliarias en {city}",
    "¿Qué inmobiliaria recomiendan en {city} para comprar casa?",
    "¿Cómo rentar un departamento en {city}?",
  ],
  "tienda online (e-commerce)": [
    "¿Dónde puedo comprar en línea con envío a {city}?",
    "mejores tiendas online que envían a {city}",
    "¿Qué tienda recomiendan para comprar en {city}?",
  ],
};

// Rubro libre (M23 — el formulario dejo de limitar a 5 opciones fijas, "no debe haber
// limitantes para que las personas puedan pedir su auditoria gratis"): si el texto que
// escribio el usuario no coincide con una de las plantillas curadas de arriba, se genera
// una plantilla generica usando el rubro tal cual lo escribio. Frases sin concordancia de
// genero a proposito (no se puede saber si "veterinaria"/"veterinario" aplica de antemano).
function genericTemplates(niche: string, city: string): string[] {
  return [
    `¿qué ${niche} recomiendan en ${city}?`,
    `mejores opciones de ${niche} en ${city}`,
    `¿dónde puedo encontrar ${niche} de confianza en ${city}?`,
    `opiniones sobre ${niche} en ${city}`,
    `¿cuánto cuesta ${niche} en ${city}?`,
  ];
}

// M16 — a diferencia de los demas ejes, "app" no es una categoria unica (una app de
// delivery y una app de notas no comparten intencion de busqueda), asi que estas preguntas
// usan el nombre de la app directamente. Miden reconocimiento directo: "si alguien pregunta
// por esta app puntual, la IA la conoce y que opina de ella" — util, pero por si solo NUNCA
// mide si la IA la recomienda organicamente sin que se lo insinuemos (bug de metodologia
// encontrado por el fundador probando su propia app: las 5 preguntas originales daban
// nombre en el 100% de los casos). Se combinan con genericTemplates(niche, city) — las
// mismas plantillas "ciegas" que ya usan local/e-commerce, usando el rubro que el negocio
// escribio (ej. "herramienta de productividad") en vez del nombre — para medir tambien
// descubrimiento organico. Aplica igual a apps nativas y apps web (M23).
const APP_TEMPLATES = [
  "¿es buena la app {appName}?",
  "opiniones sobre la app {appName}",
  "¿vale la pena usar {appName}?",
];

export function buildFreeAuditPrompts(
  niche: string,
  city: string,
  businessName?: string,
  axis?: "local" | "ecommerce" | "app",
): string[] {
  if (axis === "app") {
    const named = APP_TEMPLATES.map((t) => t.replace("{city}", city).replace("{appName}", businessName ?? ""));
    const blind = genericTemplates(niche.trim(), city).slice(0, 2);
    // intercalados para que ninguna de las dos categorias quede junta al final si algo
    // recorta el arreglo (ej. .slice(0, N) de un caller) antes de llegar a un multiplo de 5.
    return [named[0], blind[0], named[1], blind[1], named[2]];
  }

  const normalized = niche.trim().toLowerCase();
  const templates = CURATED_TEMPLATES[normalized] ?? genericTemplates(niche.trim(), city);
  return templates.map((t) => t.replace("{city}", city));
}
