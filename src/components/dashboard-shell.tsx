"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/cn";

type DashboardNavKey =
  | "navHome"
  | "navFindings"
  | "navCitations"
  | "navCompetitors"
  | "navCatalog"
  | "navApp"
  | "navPlan";

const NAV: Array<{ href: string; key: DashboardNavKey }> = [
  { href: "/dashboard", key: "navHome" },
  { href: "/dashboard/hallazgos", key: "navFindings" },
  { href: "/dashboard/citas", key: "navCitations" },
  { href: "/dashboard/competidores", key: "navCompetitors" },
  { href: "/dashboard/catalogo", key: "navCatalog" },
  { href: "/dashboard/app", key: "navApp" },
  { href: "/dashboard/plan", key: "navPlan" },
];

export function DashboardShell({
  businessName,
  children,
}: {
  businessName: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("Dashboard");
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-paper-raised">
        <Container className="flex items-center justify-between gap-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/dashboard" className="font-display text-base font-semibold text-ink">
              Radar IA
            </Link>
            <span className="hidden truncate text-sm text-text-secondary sm:inline">
              {businessName}
            </span>
          </div>
          <LanguageSwitcher />
        </Container>

        <Container>
          <nav className="flex gap-5 overflow-x-auto pb-0 [scrollbar-width:none]">
            {NAV.map((item) => {
              const active =
                item.href === "/dashboard" ? pathname === item.href : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 border-b-2 py-2.5 text-sm transition-colors duration-[var(--duration-micro)]",
                    active
                      ? "border-signal font-medium text-ink"
                      : "border-transparent text-text-secondary hover:text-ink",
                  )}
                >
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>
        </Container>
      </header>

      <Container className="py-8 sm:py-10">{children}</Container>
    </div>
  );
}
