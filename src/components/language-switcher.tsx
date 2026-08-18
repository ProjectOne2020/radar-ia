"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { locales, LOCALE_LABELS, LOCALE_COOKIE_NAME, type Locale } from "@/i18n/locales";

// Sin prefijo de idioma en la URL (ver src/i18n/request.ts) — cambiar de idioma no navega
// a otra ruta, solo actualiza la cookie que Server Components leen en el siguiente render
// y pide un refresh. router.refresh() vuelve a ejecutar los Server Components (incluido
// el layout raiz) con la cookie nueva, sin perder el estado de navegacion del cliente.
export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();

  function handleChange(next: Locale) {
    document.cookie = `${LOCALE_COOKIE_NAME}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  }

  return (
    <select
      value={locale}
      onChange={(e) => handleChange(e.target.value as Locale)}
      aria-label="Idioma / Language / Idioma"
      style={{ fontSize: 14, padding: "4px 8px", borderRadius: 4 }}
    >
      {locales.map((l) => (
        <option key={l} value={l}>
          {LOCALE_LABELS[l]}
        </option>
      ))}
    </select>
  );
}
