// M15 — formato de importacion de contenido generado externamente en Antigravity
// (03-ARQUITECTURA-TECNICA.md: "herramienta externa, no se integra por API — su output
// se sube manualmente o via script de importacion"). JSON estructurado, no Markdown —
// mas facil de validar de forma determinista antes de tocar la DB del cliente.
//
// "insertar directamente en el proyecto del cliente" tiene dos rutas distintas segun el
// tipo de contenido:
// - faqs: se insertan de verdad en prompt_sets (mismo mecanismo que M2/M3/pilar 5 ya usan
//   para medir cobertura de preguntas) — es contenido que SI vive dentro de Radar IA.
// - jsonLd / landing: Radar IA no hostea el sitio del cliente, asi que no hay donde
//   "insertarlos" en nuestra DB — se validan y se devuelven listos para que el fundador
//   los copie al sitio real del cliente durante el onboarding asistido. La automatizacion
//   real aqui es la validacion + el parseo del formato de Antigravity, no la publicacion.
export interface ImportFaq {
  question: string;
  answer: string;
}

export interface ImportJsonLdBlock {
  "@context"?: string;
  "@type"?: string;
  [key: string]: unknown;
}

export interface ImportLandingSection {
  heading: string;
  body: string;
}

export interface ImportLanding {
  title: string;
  description: string;
  sections: ImportLandingSection[];
}

export interface ContentImportPayload {
  faqs: ImportFaq[];
  jsonLd: ImportJsonLdBlock[];
  landing: ImportLanding | null;
}

export interface ContentImportValidation {
  valid: boolean;
  errors: string[];
  payload: ContentImportPayload | null;
}
