"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function SiteHeader() {
  const t = useTranslations("Nav");
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tight text-ink"
          onClick={() => setOpen(false)}
        >
          {t("brand")}
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href="/como-funciona"
            className="text-sm text-text-secondary transition-colors hover:text-ink"
          >
            {t("howItWorks")}
          </Link>
          <Link
            href="/precios"
            className="text-sm text-text-secondary transition-colors hover:text-ink"
          >
            {t("pricing")}
          </Link>
          <Link
            href="/login"
            className="text-sm text-text-secondary transition-colors hover:text-ink"
          >
            {t("login")}
          </Link>
          <LanguageSwitcher />
          <ButtonLink href="/auditoria-gratis" size="sm">
            {t("audit")}
          </ButtonLink>
        </nav>

        <button
          type="button"
          aria-label={t("menu")}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-11 w-11 flex-col items-center justify-center gap-[5px] rounded-xs border border-border-strong md:hidden"
        >
          <span
            className={cn(
              "h-px w-4 bg-ink transition-transform duration-[var(--duration-micro)]",
              open && "translate-y-[3px] rotate-45",
            )}
          />
          <span
            className={cn(
              "h-px w-4 bg-ink transition-transform duration-[var(--duration-micro)]",
              open && "-translate-y-[3px] -rotate-45",
            )}
          />
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-4 border-t border-border px-5 py-5 md:hidden">
          <Link href="/como-funciona" className="text-[0.95rem] text-text" onClick={() => setOpen(false)}>
            {t("howItWorks")}
          </Link>
          <Link href="/precios" className="text-[0.95rem] text-text" onClick={() => setOpen(false)}>
            {t("pricing")}
          </Link>
          <Link href="/login" className="text-[0.95rem] text-text" onClick={() => setOpen(false)}>
            {t("login")}
          </Link>
          <LanguageSwitcher />
          <ButtonLink href="/auditoria-gratis" size="md" onClick={() => setOpen(false)}>
            {t("audit")}
          </ButtonLink>
        </nav>
      )}
    </header>
  );
}
