import Link from "next/link";
import { useTranslations } from "next-intl";
import { Container } from "@/components/ui/container";

// M26 — footer compartido para las paginas publicas, pedido explicitamente por el
// fundador ("una pagina tambien con link desde cualquier parte de la app con los
// terminos y condiciones, otra para el tratamiento de los datos"). Antes solo el
// landing tenia un footer, inline y sin enlaces legales — el resto de paginas publicas
// no tenian ninguno. Los enlaces a /terminos y /privacidad viven aqui para que no haya
// que tocar cada pagina si cambian.
export function SiteFooter() {
  const t = useTranslations("Nav");
  const f = useTranslations("Footer");

  return (
    <footer className="border-t border-border">
      <Container className="flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="font-display text-base font-semibold text-ink">{t("brand")}</span>
          <p className="mt-1 text-sm text-text-muted">{f("tagline")}</p>
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-secondary">
          <Link href="/como-funciona" className="hover:text-ink">
            {t("howItWorks")}
          </Link>
          <Link href="/precios" className="hover:text-ink">
            {t("pricing")}
          </Link>
          <Link href="/auditoria-gratis" className="hover:text-ink">
            {t("audit")}
          </Link>
          <Link href="/listado" className="hover:text-ink">
            {f("listado")}
          </Link>
          <Link href="/agencias" className="hover:text-ink">
            {f("agencies")}
          </Link>
          <Link href="/empresas" className="hover:text-ink">
            {f("enterprise")}
          </Link>
          <Link href="/terminos" className="hover:text-ink">
            {f("terms")}
          </Link>
          <Link href="/privacidad" className="hover:text-ink">
            {f("privacy")}
          </Link>
        </nav>
      </Container>
    </footer>
  );
}
