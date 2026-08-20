import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "neutral" | "signal" | "warning" | "critical" | "good";
}) {
  const valueClass = {
    neutral: "text-ink",
    signal: "text-signal-strong",
    warning: "text-warning",
    critical: "text-critical",
    good: "text-good",
  }[tone];

  return (
    <Panel className="flex flex-col gap-1.5">
      <p className="text-xs font-medium tracking-wide text-text-secondary uppercase">{label}</p>
      <p className={cn("font-display text-3xl font-semibold", valueClass)}>{value}</p>
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
    </Panel>
  );
}
