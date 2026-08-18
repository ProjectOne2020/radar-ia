"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { locales, LOCALE_COOKIE_NAME, type Locale } from "@/i18n/locales";
import { cn } from "@/lib/cn";

const SHORT_LABEL: Record<Locale, string> = { es: "ES", en: "EN", pt: "PT" };

// Sin prefijo de idioma en la URL (ver src/i18n/request.ts) — cambiar de idioma no navega
// a otra ruta, solo actualiza la cookie que Server Components leen en el siguiente render
// y pide un refresh.
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();

  function handleChange(next: Locale) {
    document.cookie = `${LOCALE_COOKIE_NAME}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  }

  return (
    <div
      role="group"
      aria-label="Idioma / Language / Idioma"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-xs border border-border p-0.5 font-mono text-xs",
        className,
      )}
    >
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => handleChange(l)}
          aria-pressed={locale === l}
          className={cn(
            "rounded-[4px] px-2 py-1 transition-colors duration-[var(--duration-micro)]",
            locale === l
              ? "bg-ink text-text-inverse"
              : "text-text-secondary hover:bg-surface",
          )}
        >
          {SHORT_LABEL[l]}
        </button>
      ))}
    </div>
  );
}
