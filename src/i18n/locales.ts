// Idiomas soportados desde el diseño original del producto: español (LATAM hispanohablante,
// idioma principal), portugués (Brasil, mercado de lanzamiento con moneda BRL propia) e
// inglés (cobertura internacional). Sin prefijo de idioma en la URL — el idioma se
// resuelve por cookie (elegido por el usuario) o por país/Accept-Language en la primera
// visita, para no romper ningún enlace ya compartido (checkout de Stripe, plantillas de
// WhatsApp, cron, admin) con un cambio de estructura de rutas.
export const locales = ["es", "en", "pt"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "es";

export const LOCALE_COOKIE_NAME = "RADAR_LOCALE";

export const LOCALE_LABELS: Record<Locale, string> = {
  es: "Español",
  en: "English",
  pt: "Português",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
