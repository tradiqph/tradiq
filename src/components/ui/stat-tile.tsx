import { cn } from "@/lib/utils";
import { PesoAmount } from "@/components/ui/peso-amount";
import type { LucideIcon } from "lucide-react";

interface StatTileProps {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  peso?: boolean;
  gold?: boolean;
  hint?: string;
  /** Keeps tile height aligned when a sibling shows a hint line. */
  reserveHintSpace?: boolean;
  onClick?: () => void;
  className?: string;
}

export function StatTile({
  label,
  value,
  icon: Icon,
  peso,
  gold,
  hint,
  reserveHintSpace,
  onClick,
  className,
}: StatTileProps) {
  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "surface-flat p-3 text-left",
        onClick &&
          "cursor-pointer ring-1 ring-transparent transition hover:ring-amber-500/30",
        className
      )}
    >
      {Icon && <Icon className="mb-1.5 h-4 w-4 text-amber-400" />}
      <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
        {label}
      </p>
      {peso && typeof value === "number" ? (
        <PesoAmount
          amount={value}
          gold={gold}
          className={cn("text-lg", !gold && "text-white")}
        />
      ) : (
        <p className={cn("text-lg font-bold", gold ? "text-amber-400" : "text-white")}>
          {value}
        </p>
      )}
      {hint || reserveHintSpace ? (
        <p
          className={cn(
            "mt-1 text-[10px]",
            hint ? "text-amber-400/80" : "invisible"
          )}
        >
          {hint ?? "Tap to view"}
        </p>
      ) : null}
    </Comp>
  );
}
