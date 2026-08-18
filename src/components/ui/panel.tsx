import { cn } from "@/lib/cn";

export function Panel({
  className,
  raised,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { raised?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-md border border-border p-5 sm:p-6",
        raised ? "bg-paper-raised shadow-sm" : "bg-surface",
        className,
      )}
      {...props}
    />
  );
}

export function Alert({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  tone?: "neutral" | "signal" | "warning" | "critical" | "good";
}) {
  const toneClass = {
    neutral: "border-border bg-surface text-text-secondary",
    signal: "border-signal bg-signal-soft text-signal-ink",
    warning: "border-warning bg-warning-soft text-warning",
    critical: "border-critical bg-critical-soft text-critical-ink",
    good: "border-good bg-good-soft text-good",
  }[tone];

  return (
    <div
      role="alert"
      className={cn(
        "rounded-xs border-l-[3px] px-4 py-3 text-sm leading-relaxed",
        toneClass,
        className,
      )}
      {...props}
    />
  );
}
