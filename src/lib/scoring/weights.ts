// Pesos exactos de 02-METODOLOGIA-SCORING.md — literales, no se inventan ni ajustan aqui.
// La variante e-commerce usa los MISMOS pesos (el documento solo sustituye QUE se mide
// dentro de cada pilar, no el peso porcentual) — por eso un solo mapa sirve para ambos
// niches; is_ecommerce solo cambia, en el futuro (M14), de donde sale el dato de cada pilar.
export const PILLAR_WEIGHTS: Record<number, number> = {
  1: 12, // Identidad/consistencia NAP
  2: 20, // Google Business Profile / presencia local
  3: 12, // Crawlability + schema tecnico
  4: 8, // Estructura semantica de la entidad
  5: 12, // Cobertura de preguntas
  6: 15, // Citas y autoridad externa
  7: 8, // Reputacion (resenas)
  8: 13, // Medicion directa de citacion en motores de IA
};

// Suma de verificacion — si esto no da 100, algo esta mal en el mapa de arriba.
export const TOTAL_WEIGHT = Object.values(PILLAR_WEIGHTS).reduce((a, b) => a + b, 0);
