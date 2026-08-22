// P0.1 — Diccionario de identidad del cliente.
//
// Existe para responder una sola pregunta de forma determinista: "¿este texto se refiere
// al negocio auditado?". Sin esto, la clasificacion de contaminacion de prompts
// (src/lib/prompt-class/) no puede ser fiable, y sin esa clasificacion la TAO vuelve a
// contaminarse como pasaba antes de P0.1.

// Separacion obligatoria pedida por el fundador: nunca se debe poder confundir una
// variante que el negocio confirmo con una que el sistema dedujo solo. Las derivadas son
// utiles para no perder deteccion, pero son mas propensas a falsos positivos y por eso se
// tratan distinto (ver requiresCorroboration en classify-prompt.ts).
export type VariantSource = "explicit" | "derived";

export type VariantKind =
  | "trade_name" // nombre comercial
  | "legal_name" // razon social
  | "acronym" // siglas conocidas
  | "misspelling" // error ortografico frecuente
  | "domain" // dominio principal
  | "alt_domain" // dominios alternativos (.com.mx, redirecciones, landings)
  | "product_brand"; // marca de producto/servicio propia del cliente

export interface IdentityVariant {
  value: string;
  kind: VariantKind;
  source: VariantSource;
}

export interface ClientIdentity {
  clientId: string;
  /** Nombre comercial principal — el que el cliente dio al registrarse. */
  tradeName: string;
  legalName?: string | null;
  /** Ciudad declarada. Se usa SOLO para detectar colision semantica nombre+geografia. */
  city?: string | null;
  /** Rubro en texto libre. Alimenta las stopwords de categoria especificas del negocio. */
  niche?: string | null;
  variants: IdentityVariant[];
  /** Nombres de negocios competidores ya registrados (client_competitors). */
  competitorNames: string[];
}

// Resultado de evaluar un texto contra la identidad. `signals` es lo que hace auditable la
// decision: nunca se devuelve solo un booleano, siempre queda registrado QUE coincidio y
// POR QUE regla — es la misma disciplina de evidencia del resto del proyecto.
export interface IdentitySignal {
  kind:
    | "trade_name"
    | "legal_name"
    | "acronym"
    | "misspelling"
    | "domain"
    | "alt_domain"
    | "product_brand"
    | "semantic_collision"
    | "competitor";
  matched: string;
  source: VariantSource;
  /**
   * true cuando la coincidencia es de baja entropia (nombre corto o palabra generica del
   * español) y por si sola NO alcanza para afirmar que el prompt nombra al cliente.
   */
  lowConfidence: boolean;
}
