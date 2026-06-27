import { Check } from "lucide-react";
import type { RequirementChecklistItem } from "@/lib/ranks/progress";
import { cn } from "@/lib/utils";

interface RankRequirementChecklistProps {
  items: RequirementChecklistItem[];
  className?: string;
}

export function RankRequirementChecklist({
  items,
  className,
}: RankRequirementChecklistProps) {
  return (
    <ul className={cn("space-y-2", className)}>
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-2.5 text-sm">
          <span
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border",
              item.met
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                : "border-zinc-700 bg-zinc-900 text-transparent"
            )}
            aria-hidden
          >
            {item.met ? <Check className="h-3 w-3" /> : null}
          </span>
          <span className={item.met ? "text-zinc-200" : "text-zinc-500"}>
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
