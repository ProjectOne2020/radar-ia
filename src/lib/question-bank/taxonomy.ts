// M28 — catalogo acordado con el fundador para el banco de preguntas nativas: 43 rubros
// (31 verticales fisicos/de servicio de alto ticket + 12 categorias de apps, que son un
// mercado propio, no "la version app de un rubro fisico") x 18 paises (17 hispanohablantes
// + Brasil en portugues). Vive en codigo (no solo en la tabla `question_bank`) para que el
// panel de admin pueda mostrar TODAS las combinaciones posibles, incluidas las que
// todavia no tienen ni una sola pregunta cargada — el hueco es la informacion util.
export interface RubroDef {
  slug: string;
  label: string;
  categoryType: "vertical" | "app";
}

export const RUBROS: RubroDef[] = [
  // Salud (10)
  { slug: "dental", label: "Clínicas dentales", categoryType: "vertical" },
  { slug: "estetica", label: "Clínicas de estética / medicina estética", categoryType: "vertical" },
  { slug: "cirugia_plastica", label: "Cirugía plástica", categoryType: "vertical" },
  { slug: "veterinaria", label: "Clínicas veterinarias", categoryType: "vertical" },
  { slug: "optica", label: "Ópticas / oftalmología", categoryType: "vertical" },
  { slug: "fisioterapia", label: "Fisioterapia y rehabilitación", categoryType: "vertical" },
  { slug: "psicologia", label: "Psicología / salud mental", categoryType: "vertical" },
  { slug: "nutriologo", label: "Nutriólogos", categoryType: "vertical" },
  { slug: "laboratorio_clinico", label: "Laboratorios clínicos", categoryType: "vertical" },
  { slug: "spa", label: "Spas y centros de bienestar", categoryType: "vertical" },
  // Legal / profesional (5)
  { slug: "abogados", label: "Despachos de abogados", categoryType: "vertical" },
  { slug: "contadores", label: "Despachos contables", categoryType: "vertical" },
  { slug: "notaria", label: "Notarías", categoryType: "vertical" },
  { slug: "arquitectura", label: "Arquitectura / diseño de interiores", categoryType: "vertical" },
  { slug: "marketing_digital", label: "Agencias de marketing digital", categoryType: "vertical" },
  // Bienes raíces / construcción (3)
  { slug: "inmobiliaria", label: "Inmobiliarias", categoryType: "vertical" },
  { slug: "constructora", label: "Constructoras / remodelación", categoryType: "vertical" },
  { slug: "ferreteria", label: "Ferreterías", categoryType: "vertical" },
  // Automotriz (3)
  { slug: "taller_mecanico", label: "Talleres mecánicos", categoryType: "vertical" },
  { slug: "concesionaria_autos", label: "Concesionarias de autos", categoryType: "vertical" },
  { slug: "autoescuela", label: "Autoescuelas", categoryType: "vertical" },
  // Belleza (1)
  { slug: "salon_belleza", label: "Salones de belleza / barberías", categoryType: "vertical" },
  // Educación (2)
  { slug: "colegio_privado", label: "Colegios privados", categoryType: "vertical" },
  { slug: "academia_idiomas", label: "Academias de idiomas", categoryType: "vertical" },
  // Comercio (4)
  { slug: "farmacia", label: "Farmacias", categoryType: "vertical" },
  { slug: "tienda_electronica", label: "Tiendas de electrónica", categoryType: "vertical" },
  { slug: "muebles_decoracion", label: "Muebles y decoración", categoryType: "vertical" },
  { slug: "joyeria", label: "Joyerías", categoryType: "vertical" },
  // Eventos (1)
  { slug: "wedding_planner", label: "Wedding planners / organización de eventos", categoryType: "vertical" },
  // Turismo (1)
  { slug: "agencia_viajes", label: "Agencias de viajes / hoteles boutique", categoryType: "vertical" },
  // Seguros tradicionales (1)
  { slug: "seguros", label: "Corredores / agentes de seguros", categoryType: "vertical" },
  // Apps (12)
  { slug: "apps_delivery", label: "Apps de delivery de comida", categoryType: "app" },
  { slug: "apps_quickcommerce", label: "Apps de quick-commerce / súper a domicilio", categoryType: "app" },
  { slug: "apps_banca_digital", label: "Apps de banca digital / neobancos", categoryType: "app" },
  { slug: "apps_pagos", label: "Apps de pagos y billeteras digitales", categoryType: "app" },
  { slug: "apps_ridehailing", label: "Apps de ride-hailing / movilidad", categoryType: "app" },
  { slug: "apps_citas", label: "Apps de citas", categoryType: "app" },
  { slug: "apps_educacion", label: "Apps de educación en línea", categoryType: "app" },
  { slug: "apps_salud_fitness", label: "Apps de salud y fitness", categoryType: "app" },
  { slug: "apps_seguros", label: "Apps de seguros (insurtech)", categoryType: "app" },
  { slug: "apps_inmobiliarias", label: "Apps inmobiliarias", categoryType: "app" },
  { slug: "apps_empleo", label: "Apps de empleo / freelance", categoryType: "app" },
  { slug: "apps_inversion", label: "Apps de inversión / trading", categoryType: "app" },
];

export interface CountryDef {
  code: string;
  label: string;
  language: "es" | "pt";
}

export const QUESTION_BANK_COUNTRIES: CountryDef[] = [
  { code: "MX", label: "México", language: "es" },
  { code: "CO", label: "Colombia", language: "es" },
  { code: "AR", label: "Argentina", language: "es" },
  { code: "CL", label: "Chile", language: "es" },
  { code: "PE", label: "Perú", language: "es" },
  { code: "PA", label: "Panamá", language: "es" },
  { code: "VE", label: "Venezuela", language: "es" },
  { code: "EC", label: "Ecuador", language: "es" },
  { code: "HN", label: "Honduras", language: "es" },
  { code: "GT", label: "Guatemala", language: "es" },
  { code: "SV", label: "El Salvador", language: "es" },
  { code: "CR", label: "Costa Rica", language: "es" },
  { code: "BO", label: "Bolivia", language: "es" },
  { code: "PY", label: "Paraguay", language: "es" },
  { code: "UY", label: "Uruguay", language: "es" },
  { code: "DO", label: "República Dominicana", language: "es" },
  { code: "PR", label: "Puerto Rico", language: "es" },
  { code: "BR", label: "Brasil", language: "pt" },
];

export const TOTAL_COMBINATIONS = RUBROS.length * QUESTION_BANK_COUNTRIES.length;
