import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";
import ImportForm from "./import-form";

// M15 — herramienta interna del fundador para acelerar el onboarding tecnico: sube el
// contenido generado externamente en Antigravity (FAQs, JSON-LD, landing minima) para un
// cliente ya existente. Formato documentado en src/lib/content-import/types.ts.
export default async function ImportContentPage() {
  await requireAdmin();

  return (
    <main style={{ padding: 60, maxWidth: 720, fontFamily: "sans-serif" }}>
      <p>
        <Link href="/admin">← Volver</Link>
      </p>
      <h1>Importar contenido (Antigravity)</h1>
      <p>
        Sube el JSON generado en Antigravity para un cliente. Las preguntas frecuentes se insertan directo como
        preguntas activas del cliente; los bloques JSON-LD y la landing mínima se validan y se muestran listos para
        copiar al sitio real del cliente (Radar IA no hostea el sitio del cliente, así que esa parte final sigue
        siendo manual).
      </p>

      <ImportForm />
    </main>
  );
}
