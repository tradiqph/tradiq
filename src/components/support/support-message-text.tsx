import { cn } from "@/lib/utils";

interface SupportMessageTextProps {
  children: string;
  className?: string;
  as?: "p" | "div";
}

export function SupportMessageText({
  children,
  className,
  as: Tag = "p",
}: SupportMessageTextProps) {
  return (
    <Tag className={cn("whitespace-pre-wrap break-words", className)}>
      {children}
    </Tag>
  );
}
