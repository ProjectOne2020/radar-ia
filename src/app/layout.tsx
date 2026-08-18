import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Analytics } from "@vercel/analytics/next";
import { PresenceTracker } from "@/components/presence-tracker";
import { LanguageSwitcher } from "@/components/language-switcher";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <NextIntlClientProvider>
          <div style={{ position: "fixed", top: 12, right: 12, zIndex: 50 }}>
            <LanguageSwitcher />
          </div>
          {children}
          <Analytics />
          <PresenceTracker />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
