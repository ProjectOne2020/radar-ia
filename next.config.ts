import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Cabeceras de seguridad (no existia ninguna antes de la auditoria).
// - HSTS: fuerza HTTPS y evita downgrade en visitas posteriores.
// - X-Frame-Options / frame-ancestors: impide clickjacking embebiendo el
//   dashboard o el checkout en un iframe de otro sitio.
// - X-Content-Type-Options: apaga el MIME sniffing.
// - Referrer-Policy: no filtra la URL completa (que lleva freeAuditId/clientId
//   en el flujo de reporte) a terceros.
// - Permissions-Policy: apaga APIs del navegador que el producto no usa.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // no anunciar "X-Powered-By: Next.js"
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Las respuestas de API nunca deben quedar cacheadas por un CDN/proxy
        // intermedio: varias devuelven datos por cliente (reportes, dashboard).
        source: "/api/:path*",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" },
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
