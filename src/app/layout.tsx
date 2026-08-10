import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
