import { cn } from "@/lib/cn";
import { ACTIVE_ENGINES, type ActiveEngine } from "@/lib/ai-engines/types";

// P0.1 — Nombres comerciales de los motores ACTIVOS, derivados de la unica fuente de
// verdad (ACTIVE_ENGINES en src/lib/ai-engines/types.ts). Antes esta lista estaba escrita
// a mano e incluia Perplexity, que nunca corrio: por eso el hero y la pantalla de escaneo
// prometian un motor inexistente. Ahora es imposible que la UI anuncie un motor que el
// backend no llama — si cambia ACTIVE_ENGINES, esta lista cambia sola.
const DISPLAY_NAME: Record<ActiveEngine, string> = {
  openai: "ChatGPT",
  anthropic: "Claude",
  gemini: "Gemini",
};

export const AI_ENGINES = ACTIVE_ENGINES.map((e) => DISPLAY_NAME[e]) as readonly string[];

/**
 * Representacion tipografica de un motor de IA — sin logos fabricados (no
 * existen assets oficiales en el proyecto; texto + indicador es la opcion
 * segura per las brand guidelines de cada motor).
 */
export function EngineBadge({
  engine,
  detected,
  label,
  className,
}: {
  engine: string;
  detected?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xs border px-2.5 py-1 font-mono text-xs tracking-wide transition-colors duration-[var(--duration-micro)]",
        detected
          ? "border-signal/40 bg-signal-soft text-signal-ink"
          : "border-border-strong bg-surface text-text-secondary",
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          detected ? "bg-signal" : "bg-text-muted",
        )}
        aria-hidden="true"
      />
      {engine}
      {label && <span className="text-text-muted">· {label}</span>}
    </span>
  );
}
