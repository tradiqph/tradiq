import { cn } from "@/lib/utils";

interface ConsoleNavBadgeProps {
  count: number;
  className?: string;
}

export function ConsoleNavBadge({ count, className }: ConsoleNavBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        "flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm shadow-red-500/30",
        className
      )}
      aria-label={`${count} unresolved support ticket${count === 1 ? "" : "s"} today`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
