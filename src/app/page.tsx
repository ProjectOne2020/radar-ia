import Link from "next/link";
import { getTranslations } from "next-intl/server";

// Landing publica de "/" — nunca se habia construido (ningun modulo del plan original
// M0-M17 la cubria explicitamente), se quedo con el stub de scaffolding. Copy tomado
// literal de 01-CONTEXTO-NEGOCIO.md secciones 1 y 2 (que vendemos, que garantizamos y
// que no) y del hook ya probado en /auditoria-gratis — nada inventado aqui. Disponible en
// es/en/pt desde el diseño original — ver src/i18n/request.ts.
export default async function Home() {
  const t = await getTranslations("Home");

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 720, margin: "0 auto", padding: "60px 24px" }}>
      <h1 style={{ marginBottom: 4 }}>{t("brand")}</h1>
      <p style={{ color: "#666", marginTop: 0 }}>{t("tagline")}</p>

      <h2 style={{ fontSize: 28, lineHeight: 1.3, marginTop: 40 }}>{t("hookQuestion")}</h2>
      <p style={{ fontSize: 18, color: "#333" }}>{t("hookSub")}</p>

      <div style={{ display: "flex", gap: 12, margin: "24px 0" }}>
        <Link
          href="/auditoria-gratis"
          style={{
            background: "#111",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: "bold",
          }}
        >
          {t("ctaAudit")}
        </Link>
        <Link
          href="/precios"
          style={{
            border: "1px solid #ccc",
            padding: "12px 24px",
            borderRadius: 6,
            textDecoration: "none",
            color: "#111",
          }}
        >
          {t("ctaPricing")}
        </Link>
      </div>

      <h3 style={{ marginTop: 48 }}>{t("whatWeDoTitle")}</h3>
      <p>{t("whatWeDoBody")}</p>

      <h3>{t("guaranteeTitle")}</h3>
      <p>{t("guaranteeBody")}</p>

      <h3>{t("forWhomTitle")}</h3>
      <p>{t("forWhomBody")}</p>

      <p style={{ marginTop: 48, fontSize: 14, color: "#666" }}>
        {t("hasAccount")} <Link href="/login">{t("login")}</Link>
      </p>
    </main>
  );
}
