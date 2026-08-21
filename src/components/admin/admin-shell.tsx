"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

const NAV: Array<{ href: string; label: string }> = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/clientes", label: "Clientes" },
  { href: "/admin/auditorias", label: "Auditorías" },
  { href: "/admin/auditar", label: "Auditar negocio" },
  { href: "/admin/flagged", label: "Marcados" },
  { href: "/admin/partners", label: "Partners" },
  { href: "/admin/empresas", label: "Enterprise" },
  { href: "/admin/preguntas", label: "Banco de preguntas" },
  { href: "/admin/importar-contenido", label: "Importar contenido" },
  { href: "/admin/trafico", label: "Tráfico" },
];

export function AdminShell({
  children,
  title,
  actions,
}: {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}) {
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
        <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/admin" className="font-display text-base font-semibold text-ink">
              Radar IA
            </Link>
            <span className="rounded-xs border border-border-strong bg-surface px-2 py-0.5 font-mono text-xs tracking-wide text-text-secondary">
              admin
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-text-secondary hover:text-ink">
              Ir al dashboard
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-text-secondary transition-colors duration-[var(--duration-micro)] hover:text-ink"
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1180px] px-5 sm:px-8">
          <nav className="flex gap-5 overflow-x-auto pb-0 [scrollbar-width:none]">
            {NAV.map((item) => {
              const active = item.href === "/admin" ? pathname === item.href : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 border-b-2 py-2.5 text-sm whitespace-nowrap transition-colors duration-[var(--duration-micro)]",
                    active
                      ? "border-signal font-medium text-ink"
                      : "border-transparent text-text-secondary hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1180px] px-5 py-8 sm:px-8 sm:py-10">
        {(title || actions) && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            {title && <h1 className="font-display text-xl font-semibold text-ink sm:text-2xl">{title}</h1>}
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
