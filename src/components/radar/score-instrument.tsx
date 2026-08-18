import { cn } from "@/lib/cn";

/**
 * Custom score visualization — a horizontal signal-strength instrument, not a
 * generic circular donut/gauge. The fill represents how much verifiable
 * signal the audit found, running from "noise" (0) to "strong signal" (100).
 */
export function ScoreInstrument({
  score,
  noiseLabel,
  signalLabel,
  size = "lg",
  className,
}: {
  score: number;
  noiseLabel?: string;
  signalLabel?: string;
  size?: "md" | "lg";
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, score));

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-mono font-semibold tabular-nums text-ink",
            size === "lg" ? "text-6xl sm:text-7xl" : "text-4xl",
          )}
        >
          {Math.round(clamped)}
        </span>
        <span className="font-mono text-lg text-text-muted">/100</span>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
        <div
          className="h-full rounded-full bg-signal transition-[width] duration-700 ease-[var(--ease-signal)]"
          style={{ width: `${clamped}%` }}
        />
      </div>

      {(noiseLabel || signalLabel) && (
        <div className="mt-1.5 flex justify-between font-mono text-[0.7rem] uppercase tracking-wider text-text-muted">
          <span>{noiseLabel}</span>
          <span>{signalLabel}</span>
        </div>
      )}
    </div>
  );
}
