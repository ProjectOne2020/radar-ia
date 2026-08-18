import { cn } from "@/lib/cn";

export function ScoreTrend({
  points,
  className,
}: {
  points: Array<{ id: string; score: number; date: string }>;
  className?: string;
}) {
  if (points.length === 0) return null;

  const max = Math.max(100, ...points.map((p) => p.score));

  return (
    <div className={cn("w-full", className)}>
      <div className="flex h-24 items-end gap-1.5">
        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          return (
            <div key={p.id} className="group relative flex-1">
              <div
                className={cn(
                  "w-full rounded-t-[2px] transition-colors duration-[var(--duration-micro)]",
                  isLast ? "bg-signal" : "bg-surface-sunken group-hover:bg-border-strong",
                )}
                style={{ height: `${Math.max(4, (p.score / max) * 96)}px` }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-[4px] bg-ink px-2 py-1 font-mono text-[0.7rem] text-text-inverse group-hover:block">
                {Math.round(p.score)} · {p.date}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
