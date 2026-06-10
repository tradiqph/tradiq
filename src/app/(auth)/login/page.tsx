"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/ui/glass-card";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { BorderBeam } from "@/components/ui/border-beam";
import { AuthShell } from "@/components/auth/auth-shell";
import { FirebaseError } from "firebase/app";
import { useAuth } from "@/hooks/use-auth";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { toast } from "sonner";

function getLoginErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Invalid email or password";
      case "auth/invalid-email":
        return "Invalid email address";
      case "auth/too-many-requests":
        return "Too many attempts. Please wait and try again.";
      case "auth/unauthorized-domain":
        return "This domain is not authorized. Add localhost to Firebase Auth domains.";
      case "auth/network-request-failed":
        return "Network error. Check your connection.";
      default:
        return error.message || "Sign in failed";
    }
  }
  if (error instanceof Error) return error.message;
  return "Sign in failed";
}

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fieldVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.35 + i * 0.07, duration: 0.4, ease: EASE_OUT },
  }),
};

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFirebaseConfigured()) {
      toast.error(
        "Firebase env vars are missing. Save .env.local, then restart the dev server (npm run dev)."
      );
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.push("/home");
    } catch (error) {
      toast.error(getLoginErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const fieldMotion = (i: number) => ({
    custom: i,
    variants: fieldVariants,
    initial: reduceMotion ? false : ("hidden" as const),
    animate: reduceMotion ? false : ("show" as const),
  });

  return (
    <AuthShell
      heroTitle={
        <>
          Welcome back to{" "}
          <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
            TradIQ
          </span>
        </>
      }
      heroSubtitle="Sign in to manage your portfolio, track bot earnings, and access your wallet — all in one premium dashboard."
    >
      <GlassCard glow className="relative overflow-hidden p-6 md:p-8">
        <BorderBeam duration={10} />
        <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="relative z-10">
          <motion.div
            className="mb-7"
            initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Sign In
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Access your investment account
            </p>
            <motion.div
              className="mt-4 h-0.5 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-transparent"
              initial={reduceMotion ? undefined : { width: 0, opacity: 0 }}
              animate={reduceMotion ? undefined : { width: 64, opacity: 1 }}
              transition={{ delay: 0.45, duration: 0.5, ease: "easeOut" }}
            />
          </motion.div>

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
              <Label className="text-zinc-400">Password</Label>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="border-amber-500/20 bg-black/60 pl-10 pr-10 text-white transition-all placeholder:text-zinc-600 focus-visible:border-amber-500/50 focus-visible:ring-amber-500/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 transition-colors hover:text-amber-400 cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="mt-2 flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-xs text-zinc-500 transition-colors hover:text-amber-400"
                >
                  Forgot password?
                </Link>
              </div>
            </motion.div>

            <motion.div {...fieldMotion(2)}>
              <ShimmerButton type="submit" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    Signing in...
                  </span>
                ) : (
                  <>
                    Continue to dashboard
                    <motion.span
                      className="inline-flex"
                      initial={false}
                      whileHover={reduceMotion ? undefined : { x: 4 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </motion.span>
                  </>
                )}
              </ShimmerButton>
            </motion.div>
          </form>

          <motion.div
            className="relative my-6"
            {...fieldMotion(3)}
          >
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-amber-500/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-transparent px-3 text-zinc-600">
                New to TradIQ?
              </span>
            </div>
          </motion.div>

          <motion.div {...fieldMotion(4)}>
            <Link href="/register">
              <motion.button
                type="button"
                className="h-11 w-full rounded-lg border border-amber-500/30 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/10 cursor-pointer"
                whileHover={reduceMotion ? undefined : { scale: 1.01 }}
                whileTap={reduceMotion ? undefined : { scale: 0.99 }}
              >
                Create a free account
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </GlassCard>
    </AuthShell>
  );
}
