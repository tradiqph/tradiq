import { cn } from "@/lib/utils";

type GlassCardVariant = "glass" | "flat" | "accent";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
  variant?: GlassCardVariant;
}

const variantStyles: Record<GlassCardVariant, string> = {
  glass: "border-amber-500/20 bg-white/5 backdrop-blur-xl",
  flat: "border-white/5 bg-zinc-950",
  accent: "border-white/5 border-l-2 border-l-amber-400 bg-zinc-950",
};

export function GlassCard({
  className,
  glow,
  variant = "glass",
  children,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border",
        variantStyles[variant],
        glow && "shadow-[0_0_30px_rgba(212,175,55,0.08)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
