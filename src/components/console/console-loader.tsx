import { cn } from "@/lib/utils";

type ConsoleLoaderVariant = "fullscreen" | "page" | "section";

interface ConsoleLoaderProps {
  variant?: ConsoleLoaderVariant;
  label?: string;
  className?: string;
}

const variantStyles: Record<ConsoleLoaderVariant, string> = {
  fullscreen: "min-h-dvh w-full bg-black",
  page: "min-h-[40vh] w-full",
  section: "w-full py-10",
};

const sizeStyles: Record<ConsoleLoaderVariant, { ring: string; dollar: string }> =
  {
    fullscreen: { ring: "h-16 w-16", dollar: "text-2xl" },
    page: { ring: "h-14 w-14", dollar: "text-xl" },
    section: { ring: "h-11 w-11", dollar: "text-lg" },
  };

export function ConsoleLoader({
  variant = "page",
  label,
  className,
}: ConsoleLoaderProps) {
  const sizes = sizeStyles[variant];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4",
        variantStyles[variant],
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={label ?? "Loading"}
    >
      <div className={cn("relative flex items-center justify-center", sizes.ring)}>
        <div
          className={cn(
            "absolute inset-0 rounded-full bg-amber-500/15 console-ring-glow",
            sizes.ring
          )}
        />
        <div
          className={cn(
            "absolute inset-0 animate-spin rounded-full border-2 border-amber-500/20 border-t-amber-400",
            sizes.ring
          )}
        />
        <div
          className={cn(
            "relative flex items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10",
            sizes.ring
          )}
        >
          <span
            className={cn(
              "inline-block font-bold text-amber-400 console-dollar-pulse",
              sizes.dollar
            )}
          >
            $
          </span>
        </div>
      </div>
      {label && (
        <p className="text-sm font-medium text-zinc-400">{label}</p>
      )}
    </div>
  );
}
