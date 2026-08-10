// Preguntas plantilla para la auditoria gratis (04-MODULOS-CONSTRUCCION.md M6: "5-10
// preguntas, no el set completo de un plan pagado"). No hay ningun modulo dedicado a
// generar prompt_sets por nicho todavia (M15/Antigravity es para contenido completo del
// sitio del cliente, no para esto) — son plantillas curadas a mano, en el mismo tono del
// ejemplo de copy ya validado en 01-CONTEXTO-NEGOCIO.md seccion 7. Ajustables por el
// fundador; no son un peso de scoring ni un precio, son solo el texto de las preguntas.
const TEMPLATES: Record<string, string[]> = {
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
  ecommerce: [
    "¿Dónde puedo comprar en línea con envío a {city}?",
    "mejores tiendas online que envían a {city}",
    "¿Qué tienda recomiendan para comprar en {city}?",
  ],
};

export function buildFreeAuditPrompts(niche: string, city: string): string[] {
  const templates = TEMPLATES[niche] ?? TEMPLATES.dental;
  return templates.map((t) => t.replace("{city}", city));
}
