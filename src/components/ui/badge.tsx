import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badge = cva(
  "inline-flex items-center gap-1.5 rounded-xs px-2 py-0.5 text-xs font-medium font-mono tracking-wide",
  {
    variants: {
      tone: {
        neutral: "bg-surface text-text-secondary border border-border",
        signal: "bg-signal-soft text-signal-ink",
        observed: "bg-observed-soft text-observed-ink",
        good: "bg-good-soft text-good",
        warning: "bg-warning-soft text-warning",
        critical: "bg-critical-soft text-critical-ink",
        unmeasured: "bg-unmeasured-soft text-unmeasured-ink rd-hatch",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

type BadgeVariants = VariantProps<typeof badge>;

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & BadgeVariants) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}
