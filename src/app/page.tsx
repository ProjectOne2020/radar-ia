import Link from "next/link";

// Landing publica de "/" — nunca se habia construido (ningun modulo del plan original
// M0-M17 la cubria explicitamente), se quedo con el stub de scaffolding. Copy tomado
// literal de 01-CONTEXTO-NEGOCIO.md secciones 1 y 2 (que vendemos, que garantizamos y
// que no) y del hook ya probado en /auditoria-gratis — nada inventado aqui.
export default function Home() {
  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 720, margin: "0 auto", padding: "60px 24px" }}>
      <h1 style={{ marginBottom: 4 }}>Radar IA</h1>
      <p style={{ color: "#666", marginTop: 0 }}>Visibilidad en IA para negocios LATAM</p>

      <h2 style={{ fontSize: 28, lineHeight: 1.3, marginTop: 40 }}>
        ¿Sabes si ChatGPT, Claude o Gemini recomiendan tu negocio cuando alguien pregunta en tu ciudad?
      </h2>
      <p style={{ fontSize: 18, color: "#333" }}>Te lo mostramos en un par de minutos, gratis.</p>

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
          Auditar mi negocio gratis
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
          Ver precios
        </Link>
      </div>

      <h3 style={{ marginTop: 48 }}>Qué hacemos</h3>
      <p>
        Auditoría inicial → arreglo técnico y de contenido → monitoreo continuo con reporte, para que tu negocio
        aparezca más y mejor en las respuestas de motores de IA cuando alguien pregunta algo relacionado con tu
        rubro y ciudad.
      </p>

      <h3>Qué garantizamos y qué no</h3>
      <p>
        No podemos controlar qué negocio recomienda una IA — ni OpenAI ni Google ofrecen esa garantía en sus
        propios sistemas, así que nosotros tampoco. Sí podemos controlar qué tan completa, consistente,
        estructurada y verificable es la información que esa IA encuentra sobre tu negocio — y medirlo mes a mes.
      </p>

      <h3>Para quién es</h3>
      <p>Clínicas dentales y de estética, inmobiliarias, tiendas online, y apps móviles o digitales.</p>

      <p style={{ marginTop: 48, fontSize: 14, color: "#666" }}>
        ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
      </p>
    </main>
  );
}
