import { cn } from "@/lib/utils";
import { PesoAmount } from "@/components/ui/peso-amount";
import type { LucideIcon } from "lucide-react";

interface StatTileProps {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  peso?: boolean;
  gold?: boolean;
  className?: string;
}

export function StatTile({
  label,
  value,
  icon: Icon,
  peso,
  gold,
  className,
}: StatTileProps) {
  return (
    <div className={cn("surface-flat p-3", className)}>
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
    </div>
  );
}
