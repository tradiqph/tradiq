"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Shield, Sparkles } from "lucide-react";

interface AuthShellProps {
  children: React.ReactNode;
  heroTitle: React.ReactNode;
  heroSubtitle: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  }),
};

export function AuthShell({ children, heroTitle, heroSubtitle }: AuthShellProps) {
  const reduceMotion = useReducedMotion();

  const motionProps = (i: number) =>
    reduceMotion
      ? {}
      : {
          initial: "hidden" as const,
          animate: "show" as const,
          custom: i,
          variants: fadeUp,
        };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-black">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-amber-500/12 blur-[120px]"
          animate={
            reduceMotion
              ? undefined
              : { scale: [1, 1.08, 1], opacity: [0.12, 0.18, 0.12] }
          }
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute right-0 bottom-0 h-80 w-80 rounded-full bg-yellow-600/8 blur-[100px]" />
        <div className="absolute top-1/3 -left-20 h-64 w-64 rounded-full bg-amber-400/5 blur-[80px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(212,175,55,0.8) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-6xl flex-col px-4 py-6 md:px-8">
        <motion.header
          className="relative mb-6 flex items-center md:mb-8"
          {...motionProps(0)}
        >
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-amber-400"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to home</span>
          </Link>
          <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 justify-center">
            <Image
              src="/assets/logo-tradiq.png"
              alt="TradIQ"
              width={240}
              height={160}
              className="h-12 w-auto opacity-95 sm:h-14 md:h-16"
              priority
            />
          </div>
          <div className="ml-auto w-10 sm:w-28" aria-hidden />
        </motion.header>

        <div className="flex flex-1 flex-col items-center justify-center gap-10 pb-8 lg:flex-row lg:items-center lg:gap-16">
          <div className="w-full max-w-md lg:max-w-lg">
            <motion.div
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm text-amber-400"
              {...motionProps(1)}
            >
              <Sparkles className="h-4 w-4" />
              Secure Access
            </motion.div>
            <motion.h1
              className="text-3xl font-bold leading-tight text-white md:text-4xl"
              {...motionProps(2)}
            >
              {heroTitle}
            </motion.h1>
            <motion.p
              className="mt-3 text-base leading-relaxed text-zinc-400"
              {...motionProps(3)}
            >
              {heroSubtitle}
            </motion.p>

            <motion.div
              className="relative mt-8 overflow-hidden rounded-2xl border border-amber-500/20"
              {...motionProps(4)}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-transparent to-transparent" />
              <motion.div
                className="relative"
                animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              >
                <Image
                  src="/assets/auth-login-hero.png"
                  alt="TradIQ secure login"
                  width={600}
                  height={500}
                  className="relative w-full object-cover"
                  priority
                />
              </motion.div>
            </motion.div>

            <motion.div
              className="mt-6 grid grid-cols-3 gap-3"
              {...motionProps(5)}
            >
              {[
                { value: "3%", label: "Daily Returns" },
                { value: "QR Ph", label: "Deposits" },
                { value: "24/7", label: "Bot Trading" },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  className="rounded-xl border border-amber-500/15 bg-white/5 px-3 py-3 text-center backdrop-blur-sm"
                  initial={reduceMotion ? undefined : { opacity: 0, scale: 0.95 }}
                  animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.1, duration: 0.35 }}
                >
                  <p className="text-lg font-bold text-amber-400">{stat.value}</p>
                  <p className="text-[10px] text-zinc-500">{stat.label}</p>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              className="mt-5 flex items-center gap-2 text-xs text-zinc-600"
              {...motionProps(6)}
            >
              <Shield className="h-3.5 w-3.5 text-amber-500/70" />
              <span>256-bit encrypted · Firebase secured authentication</span>
            </motion.div>
          </div>

          <motion.div
            className="w-full max-w-md"
            initial={reduceMotion ? undefined : { opacity: 0, x: 24 }}
            animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
            transition={{ delay: 0.25, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
