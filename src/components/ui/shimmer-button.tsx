"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface ShimmerButtonProps extends HTMLMotionProps<"button"> {
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
    <motion.button
      type={type}
      disabled={disabled}
      className={cn(
        "group relative inline-flex w-full overflow-hidden rounded-lg disabled:cursor-not-allowed disabled:opacity-70",
        className
      )}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      whileHover={disabled ? undefined : { scale: 1.01 }}
      {...props}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
        initial={{ x: "-100%" }}
        animate={disabled ? { x: "-100%" } : { x: "200%" }}
        transition={
          disabled
            ? undefined
            : {
                duration: 2.2,
                repeat: Infinity,
                ease: "linear",
                repeatDelay: 0.8,
              }
        }
      />
      <span className="relative z-10 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-600 to-yellow-500 px-4 py-2.5 text-base font-semibold text-black">
        {children}
      </span>
    </motion.button>
  );
}
