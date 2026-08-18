import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, LOCALE_COOKIE_NAME, type Locale } from "./locales";

// Resuelve el idioma sin prefijo de URL: (1) cookie explicita del usuario (seteada por el
// selector de idioma), (2) pais detectado por el proxy (x-radar-country, mismo header de
// M8) — Brasil entra en portugues por default, (3) Accept-Language del navegador, (4)
// español como default final. Se ejecuta en cada request de Server Component.
async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  const headerStore = await headers();
  const country = headerStore.get("x-radar-country");
  if (country === "BR") return "pt";

  const acceptLanguage = (headerStore.get("accept-language") ?? "").toLowerCase();
  if (acceptLanguage.startsWith("pt")) return "pt";
  if (acceptLanguage.startsWith("en")) return "en";
  if (acceptLanguage.startsWith("es")) return "es";

  return defaultLocale;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
