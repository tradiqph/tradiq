import Link from "next/link";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}

export function SectionHeader({
  title,
  actionLabel,
  actionHref,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("mb-3 flex items-center justify-between", className)}>
      <h2 className="font-bold text-white">{title}</h2>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="text-sm text-amber-400">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
