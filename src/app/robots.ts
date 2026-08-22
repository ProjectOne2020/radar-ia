import type { MetadataRoute } from "next";

// M27 — dogfooding (05-MARKETING-DISTRIBUCION.md seccion 2.4): aplicar al propio sitio
// la misma practica que el producto audita en sus clientes (pilar 3, crawlability —
// 02-METODOLOGIA-SCORING.md: "bloqueado = invisible, sin gradiente", el factor de mayor
// peso dentro de ese pilar). Sin este archivo, Next no genera ningun robots.txt y el
// comportamiento por default de los crawlers de IA frente a un sitio sin robots.txt
// varia por bot — mejor ser explicito. Se permiten los crawlers de los motores que el
// producto mismo mide (OpenAI, Anthropic, Google, Perplexity) mas los agentes de
// navegación en tiempo real que citan paginas puntuales, y los de busqueda estandar.
const AI_AND_SEARCH_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "anthropic-ai",
  "Claude-Web",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Googlebot",
  "Bingbot",
  "CCBot",
  "Amazonbot",
  "meta-externalagent",
];

const DISALLOWED_PATHS = ["/api/", "/admin/", "/dashboard/", "/checkout/"];

export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://radar.omniflowcreator.com";

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOWED_PATHS },
      ...AI_AND_SEARCH_BOTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: DISALLOWED_PATHS,
      })),
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
