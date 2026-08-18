import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Analytics } from "@vercel/analytics/next";
import { PresenceTracker } from "@/components/presence-tracker";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-display-src",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz", "SOFT", "WONK"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-body-src",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-data-src",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body>
        <NextIntlClientProvider>
          {children}
          <Analytics />
          <PresenceTracker />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
