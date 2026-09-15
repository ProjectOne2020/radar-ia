import type { MetadataRoute } from "next";

// M27 — dogfooding, complemento de robots.ts: lista las paginas publicas de marketing
// (no las paginas transaccionales/privadas de /dashboard, /admin, /checkout, ni las
// paginas de flujo con estado como /auditoria-gratis/verificar o /reporte, que no tienen
// sentido como URL indexable).
const PUBLIC_PATHS = [
  "",
  "/como-funciona",
  "/precios",
  "/auditoria-gratis",
  "/listado",
  "/agencias",
  "/empresas",
  "/terminos",
  "/privacidad",
  "/login",
  // M28 — paginas de respuesta directa (dogfooding pilar 5), cada una su propia URL
  // indexable en vez de vivir solo como parrafos dentro de otra pagina.
  "/que-es-geo",
  "/como-aparecer-en-chatgpt",
  "/radar-ia-vs-mentio",
  "/cuanto-cuesta-medir-visibilidad-ia",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://radar.omniflowcreator.com";

  return PUBLIC_PATHS.map((path) => ({
    url: `${appUrl}${path}`,
    lastModified: new Date(),
  }));
}
