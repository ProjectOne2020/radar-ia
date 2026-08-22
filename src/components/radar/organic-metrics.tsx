import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import type { BrandRecognitionResult, TaoResult } from "@/lib/metrics/tao";

// P0.1 — Presentacion SEPARADA de las dos metricas.
//
// El defecto que P0.1 corrige no era solo de calculo: era que un solo numero mezclaba
// "¿te encuentran sin conocerte?" con "¿te reconocen si les dan tu nombre?". Este
// componente existe para que esa mezcla sea imposible tambien en pantalla — son dos
// bloques distintos, con leyendas distintas, y no hay ninguna forma de renderizar su
// promedio.
//
// Se muestran CONTEOS (k de n), no porcentajes con decimales: con muestras de ~15-25
// preguntas un porcentaje sugiere una precision que los datos no sostienen.

function Metric({
  title,
  help,
  emptyLabel,
  badgeLabel,
  appearances,
  total,
  tone,
}: {
  title: string;
  help: string;
  emptyLabel: string;
  /** Ya resuelto por el llamador segun haya o no apariciones — este componente no traduce. */
  badgeLabel: string;
  appearances: number;
  total: number;
  tone: "signal" | "observed";
}) {
  if (total === 0) {
    return (
      <Panel raised className="flex flex-col gap-2">
        <h3 className="font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
          {title}
        </h3>
        <p className="text-sm text-text-muted">{emptyLabel}</p>
      </Panel>
    );
  }

  return (
    <Panel raised className="flex flex-col gap-2">
      <h3 className="font-display text-sm font-semibold tracking-wide text-text-secondary uppercase">
        {title}
      </h3>
      <p className="flex items-baseline gap-2">
        <span className="font-display text-4xl font-semibold text-ink">{appearances}</span>
        <span className="text-lg text-text-secondary">/ {total}</span>
        <Badge tone={tone}>{badgeLabel}</Badge>
      </p>
      <p className="text-sm leading-relaxed text-text-secondary">{help}</p>
    </Panel>
  );
}

export function OrganicMetrics({
  tao,
  brand,
  labels,
}: {
  tao: TaoResult;
  brand: BrandRecognitionResult;
  labels: {
    taoTitle: string;
    taoHelp: string;
    taoNone: string;
    brandTitle: string;
    brandHelp: string;
    brandNone: string;
    metricsNote: string;
    /** Etiqueta del badge cuando hay al menos una aparicion. */
    appearances: string;
    /** Etiqueta del badge cuando el conteo es cero. */
    noAppearances: string;
  };
}) {
  const badge = (count: number) => (count === 0 ? labels.noAppearances : labels.appearances);

  return (
    <section className="mt-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Metric
          title={labels.taoTitle}
          help={labels.taoHelp}
          emptyLabel={labels.taoNone}
          badgeLabel={badge(tao.promptsWithAppearance)}
          appearances={tao.promptsWithAppearance}
          total={tao.samplePrompts}
          tone="signal"
        />
        <Metric
          title={labels.brandTitle}
          help={labels.brandHelp}
          emptyLabel={labels.brandNone}
          badgeLabel={badge(brand.appearances)}
          appearances={brand.appearances}
          total={brand.sampleRuns}
          tone="observed"
        />
      </div>
      <p className="mt-3 text-xs text-text-muted">{labels.metricsNote}</p>
    </section>
  );
}
