import { cn } from "@/lib/cn";

export function ProgressSteps({
  current,
  total,
  label,
  className,
}: {
  current: number;
  total: number;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-[var(--duration-reveal)]",
              i <= current ? "bg-signal" : "bg-surface-sunken",
            )}
          />
        ))}
      </div>
      <p className="mt-2 font-mono text-xs text-text-muted">{label}</p>
    </div>
  );
}
