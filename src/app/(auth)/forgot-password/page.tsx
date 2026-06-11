"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/ui/glass-card";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { BorderBeam } from "@/components/ui/border-beam";
import { AuthShell } from "@/components/auth/auth-shell";
import { toast } from "sonner";

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fieldVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.35 + i * 0.07, duration: 0.4, ease: EASE_OUT },
  }),
};

export default function ForgotPasswordPage() {
  const reduceMotion = useReducedMotion();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const fieldMotion = (i: number) => ({
    custom: i,
    variants: fieldVariants,
    initial: reduceMotion ? false : ("hidden" as const),
    animate: reduceMotion ? false : ("show" as const),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json()) as { message?: string; error?: string };

      if (!res.ok) {
        toast.error(data.error ?? "Could not send reset email");
        return;
      }

      setSent(true);
      toast.success(data.message ?? "Check your inbox for reset instructions");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      heroTitle={
        <>
          Secure access to{" "}
          <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
            TradIQ
          </span>
        </>
      }
      heroSubtitle="We'll email you a secure link to reset your password. The link expires in one hour."
    >
      <GlassCard glow className="relative overflow-hidden p-6 md:p-8">
        <BorderBeam />
        <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="relative z-10">
          <motion.div
            className="mb-7"
            initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Forgot password
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {sent
                ? "If your email is registered, you'll receive a reset link shortly."
                : "Enter the email on your TradIQ account"}
            </p>
          </motion.div>

          {sent ? (
            <motion.div {...fieldMotion(0)} className="space-y-6">
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-zinc-300">
                Check your inbox and spam folder for an email from{" "}
                <span className="text-amber-400">noreply@tradiq.biz</span>.
              </div>
              <Link href="/login">
                <motion.button
                  type="button"
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-amber-500/30 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/10 cursor-pointer"
                  whileHover={reduceMotion ? undefined : { scale: 1.01 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.99 }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to sign in
                </motion.button>
              </Link>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <motion.div {...fieldMotion(0)}>
                <Label className="text-zinc-400">Email</Label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    autoComplete="email"
                    className="border-amber-500/20 bg-black/60 pl-10 text-white transition-all placeholder:text-zinc-600 focus-visible:border-amber-500/50 focus-visible:ring-amber-500/20"
                    required
                  />
                </div>
              </motion.div>

              <motion.div {...fieldMotion(1)}>
                <ShimmerButton type="submit" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                      Sending...
                    </span>
                  ) : (
                    <>
                      Send reset link
                      <motion.span
                        className="inline-flex"
                        initial={false}
                        whileHover={reduceMotion ? undefined : { x: 4 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 20,
                        }}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </motion.span>
                    </>
                  )}
                </ShimmerButton>
              </motion.div>

              <motion.div {...fieldMotion(2)}>
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 text-sm text-zinc-500 transition-colors hover:text-amber-400"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to sign in
                </Link>
              </motion.div>
            </form>
          )}
        </div>
      </GlassCard>
    </AuthShell>
  );
}
