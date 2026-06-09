import { formatPeso } from "@/lib/finance";
import { cn } from "@/lib/utils";

interface PesoAmountProps {
  amount: number;
  className?: string;
  gold?: boolean;
}

export function PesoAmount({ amount, className, gold }: PesoAmountProps) {
  return (
    <span
      className={cn(
        "font-bold tabular-nums",
        gold && "text-amber-400",
        className
      )}
    >
      {formatPeso(amount)}
    </span>
  );
}
