"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
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

const PLAN_LABEL: Record<string, string> = { lite: "Lite", plus: "Plus", pro: "Pro", enterprise: "Enterprise" };

export function DashboardShell({
  businessName,
  plan,
  planStatus,
  isAdmin,
  children,
}: {
  businessName: string;
  plan: string | null;
  planStatus: string | null;
  isAdmin?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("Dashboard");
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

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
            {plan && (
              <Badge tone={planStatus === "past_due" ? "warning" : "signal"}>
                {t("planBadge", { plan: PLAN_LABEL[plan] ?? plan })}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link
                href="/admin"
                className="rounded-xs border border-border-strong px-2 py-1 text-sm font-medium text-text-secondary hover:border-signal hover:text-ink"
              >
                {t("navAdmin")}
              </Link>
            )}
            <Link href="/listado" className="text-sm text-text-secondary hover:text-ink">
              {t("navPublicListing")}
            </Link>
            <LanguageSwitcher />
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-text-secondary transition-colors duration-[var(--duration-micro)] hover:text-ink"
            >
              {t("logout")}
            </button>
          </div>
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

      <footer className="border-t border-border">
        <Container className="flex flex-wrap gap-x-5 gap-y-2 py-6 text-xs text-text-muted">
          <Link href="/terminos" className="hover:text-text-secondary">
            {t("footerTerms")}
          </Link>
          <Link href="/privacidad" className="hover:text-text-secondary">
            {t("footerPrivacy")}
          </Link>
        </Container>
      </footer>
    </div>
  );
}
