import { cn } from "@/lib/cn";

export const AI_ENGINES = ["ChatGPT", "Claude", "Gemini", "Perplexity"] as const;
export type AiEngine = (typeof AI_ENGINES)[number];

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
