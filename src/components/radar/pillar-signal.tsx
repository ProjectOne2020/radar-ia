import { cn } from "@/lib/cn";

export type PillarStatus = "good" | "warning" | "critical" | "unmeasured";

const SEGMENTS = 5;

const FILL_CLASS: Record<Exclude<PillarStatus, "unmeasured">, string> = {
  good: "bg-signal",
  warning: "bg-warning",
  critical: "bg-critical",
};

/**
 * One row of the 8-pillar breakdown. "unmeasured" is rendered as a distinct
 * hatched/muted state — never colored red — so "no data yet" can't be
 * mistaken for "bad."
 */
export function PillarSignal({
  name,
  weight,
  status,
  value,
  notMeasuredLabel,
  className,
}: {
  name: string;
  weight: number;
  status: PillarStatus;
  value?: number;
  notMeasuredLabel?: string;
  className?: string;
}) {
  const filled =
    status === "unmeasured" ? 0 : Math.round(((value ?? 0) / 100) * SEGMENTS);

  return (
    <div className={cn("flex items-center justify-between gap-4 py-3", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm text-text">{name}</span>
          <span className="shrink-0 font-mono text-[0.7rem] text-text-muted">{weight}%</span>
        </div>
        {status === "unmeasured" && (
          <span className="mt-0.5 block text-xs text-text-muted">{notMeasuredLabel}</span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1" aria-hidden="true">
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-4 w-2 rounded-[2px]",
              status === "unmeasured"
                ? "rd-hatch bg-unmeasured-soft"
                : i < filled
                  ? FILL_CLASS[status]
                  : "bg-surface-sunken",
            )}
          />
        ))}
      </div>
    </div>
  );
}
