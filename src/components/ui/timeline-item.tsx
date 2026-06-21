import { cn } from "@/lib/utils";

interface TimelineItemProps {
  children: React.ReactNode;
  isLast?: boolean;
  className?: string;
}

export function TimelineItem({ children, isLast, className }: TimelineItemProps) {
  return (
    <div className={cn("relative flex gap-3 pl-4", className)}>
      <div className="absolute left-0 top-0 bottom-0 flex w-4 flex-col items-center">
        <span className="mt-5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
        {!isLast && (
          <span className="mt-1 w-px flex-1 bg-amber-500/20" />
        )}
      </div>
      <div className="surface-flat mb-2 min-w-0 flex-1 overflow-hidden p-3">
        {children}
      </div>
    </div>
  );
}
