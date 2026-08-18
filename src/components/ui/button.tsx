import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const button = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-[var(--duration-micro)] disabled:opacity-40 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-white hover:bg-primary-strong hover:rd-glow-primary",
        secondary:
          "bg-transparent text-text border border-border-strong hover:border-primary hover:bg-surface",
        ghost: "bg-transparent text-text hover:bg-surface",
        signal:
          "bg-transparent text-signal-strong border border-signal hover:bg-signal-soft",
      },
      size: {
        sm: "text-sm px-3.5 py-2.5 rounded-xs min-h-[38px]",
        md: "text-[0.95rem] px-5 py-3 rounded-sm min-h-[44px]",
        lg: "text-base px-7 py-4 rounded-sm min-h-[48px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonVariants = VariantProps<typeof button>;

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & ButtonVariants) {
  return <button className={cn(button({ variant, size }), className)} {...props} />;
}

export function ButtonLink({
  className,
  variant,
  size,
  href,
  ...props
}: React.ComponentProps<typeof Link> & ButtonVariants) {
  return <Link href={href} className={cn(button({ variant, size }), className)} {...props} />;
}
