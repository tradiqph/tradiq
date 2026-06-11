"use client";

import { cn } from "@/lib/utils";

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function ShimmerButton({
  children,
  className,
  disabled,
  type = "button",
  ...props
}: ShimmerButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "group relative inline-flex w-full overflow-hidden rounded-lg transition-transform active:scale-[0.98] hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100",
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
      />
      <span className="relative z-10 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-600 to-yellow-500 px-4 py-2.5 text-base font-semibold text-black">
        {children}
      </span>
    </button>
  );
}
