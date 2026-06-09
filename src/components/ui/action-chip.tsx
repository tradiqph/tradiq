import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface ActionChipProps {
  label: string;
  href: string;
  icon?: LucideIcon;
  className?: string;
}

export function ActionChip({ label, href, icon: Icon, className }: ActionChipProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-zinc-950 px-4 py-2 text-xs text-zinc-300 transition-colors hover:border-amber-500/40 hover:text-amber-400 motion-safe:transition-colors",
        className
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 text-amber-400" />}
      {label}
    </Link>
  );
}
