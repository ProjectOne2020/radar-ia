// Modelo barato de Groq para procesamiento intermedio (regla de costo de
// 03-ARQUITECTURA-TECNICA.md) — nunca la medicion final del pilar 8.
//
// Migrado de llama-3.1-8b-instant a openai/gpt-oss-20b (agosto 2026): Groq avisó el
// retiro de llama-3.1-8b-instant para el 16 de agosto de 2026 y recomienda este modelo
// como reemplazo. Verificado en vivo que responde en el mismo formato que ya usa el
// codigo (response_format json_object, message.content).
export const GROQ_MODEL = "openai/gpt-oss-20b";
