import { cn } from "@/lib/cn";

export function DistBarChart({
  data,
  formatValue = (v) => String(v),
  className,
}: {
  data: Array<{ label: string; value: number }>;
  formatValue?: (value: number) => string;
  className?: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-text-muted">Sin datos todavía.</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-sm text-text-secondary" title={d.label}>
            {d.label}
          </span>
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full bg-signal transition-[width] duration-[var(--duration-micro)]"
              style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }}
            />
          </div>
          <span className="w-14 shrink-0 text-right font-mono text-sm text-ink">{formatValue(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function TrendBarChart({
  points,
  formatValue = (v) => String(Math.round(v)),
  className,
}: {
  points: Array<{ key: string; value: number; label: string }>;
  formatValue?: (value: number) => string;
  className?: string;
}) {
  if (points.length === 0) {
    return <p className="text-sm text-text-muted">Sin datos todavía.</p>;
  }

  const max = Math.max(...points.map((p) => p.value), 1);

  return (
    <div className={cn("w-full", className)}>
      <div className="flex h-28 items-end gap-1.5">
        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          return (
            <div key={p.key} className="group relative flex-1">
              <div
                className={cn(
                  "w-full rounded-t-[2px] transition-colors duration-[var(--duration-micro)]",
                  isLast ? "bg-signal" : "bg-surface-sunken group-hover:bg-border-strong",
                )}
                style={{ height: `${Math.max(4, (p.value / max) * 108)}px` }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-[4px] bg-ink px-2 py-1 font-mono text-[0.7rem] text-text-inverse group-hover:block">
                {formatValue(p.value)} · {p.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
