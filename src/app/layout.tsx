import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Analytics } from "@vercel/analytics/next";
import { PresenceTracker } from "@/components/presence-tracker";
import { JsonLd } from "@/components/seo/json-ld";
import "./globals.css";

// M21 — Geist (identidad Vercel/Linear-aligned, un solo sans variable para
// display+cuerpo, jerarquia via peso/tamano) reemplaza Fraunces/IBM Plex Sans
// de M19. Geist Mono se mantiene para datos (scores, timestamps, badges) —
// ver 03-ARQUITECTURA-TECNICA.md "Sistema de diseno".
const geist = Geist({
  variable: "--font-geist-src",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-data-src",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Radar IA",
  description: "Visibilidad en IA para negocios LATAM",
  other: {
    // Verificacion de propiedad del sitio en Bing Webmaster Tools (necesaria para
    // obtener la API key de BING_WEBMASTER_API_KEY usada en M2/M3).
    "msvalidate.01": "4FFC8EB70DA017561BAB64AC25879887",
  },
};

// M27 — dogfooding: Organization + Service en JSON-LD sitewide (mismo Organization ->
// Servicios que el pilar 4 audita en los clientes, aplicado a la marca misma —
// 05-MARKETING-DISTRIBUCION.md seccion 2.4).
async function organizationSchema(appUrl: string) {
  const t = await getTranslations("Home");
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Radar IA",
    url: appUrl,
    description: t("whatWeDoBody"),
    areaServed: ["MX", "CO", "CL", "PE", "AR", "BR"],
    makesOffer: {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "Auditoría y monitoreo de visibilidad en motores de IA",
        description: t("whatWeDoBody"),
      },
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://radar.omniflowcreator.com";

  return (
    <html lang={locale} className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        <NextIntlClientProvider>
          <JsonLd data={await organizationSchema(appUrl)} />
          {children}
          <Analytics />
          <PresenceTracker />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
