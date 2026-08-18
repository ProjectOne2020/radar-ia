import { cn } from "@/lib/cn";

export function Container({
  className,
  narrow,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { narrow?: boolean }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-8",
        narrow ? "max-w-[720px]" : "max-w-[1180px]",
        className,
      )}
      {...props}
    />
  );
}
