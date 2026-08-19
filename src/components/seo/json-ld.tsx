// M27 — dogfooding (05-MARKETING-DISTRIBUCION.md 2.4): datos estructurados en JSON-LD,
// la misma practica que el pilar 4 de 02-METODOLOGIA-SCORING.md audita en los clientes
// (jerarquia Organization -> Servicios). JSON.stringify sobre datos generados en el
// servidor (nunca input de usuario) — no hay riesgo de inyeccion via dangerouslySetInnerHTML.
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
