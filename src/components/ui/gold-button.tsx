import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GoldButtonProps extends React.ComponentProps<typeof Button> {}

export function GoldButton({ className, children, ...props }: GoldButtonProps) {
  return (
    <Button
      className={cn(
        "bg-gradient-to-r from-amber-600 to-yellow-500 text-black font-semibold hover:from-amber-500 hover:to-yellow-400 border-0",
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
}
