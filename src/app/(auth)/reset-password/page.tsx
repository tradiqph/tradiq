"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { FirebaseError } from "firebase/app";
import {
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/ui/glass-card";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { BorderBeam } from "@/components/ui/border-beam";
import { AuthShell } from "@/components/auth/auth-shell";
import { auth, isFirebaseConfigured } from "@/lib/firebase/client";
import { passwordResetOobCodeSchema } from "@/lib/security/validation";
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

type PageState = "verifying" | "ready" | "invalid" | "success";

function getResetErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/expired-action-code":
        return "This reset link has expired. Request a new one.";
      case "auth/invalid-action-code":
        return "This reset link is invalid or was already used.";
      case "auth/user-disabled":
        return "This account has been disabled. Contact support.";
      case "auth/weak-password":
        return "Password is too weak. Use at least 6 characters.";
      case "auth/network-request-failed":
        return "Network error. Check your connection and try again.";
      default:
        return error.message || "Could not reset password";
    }
  }
  if (error instanceof Error) return error.message;
  return "Could not reset password";
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const rawOobCode = searchParams.get("oobCode")?.trim() ?? "";
  const parsedOobCode = passwordResetOobCodeSchema.safeParse(rawOobCode);
  const oobCode = parsedOobCode.success ? parsedOobCode.data : "";

  const [pageState, setPageState] = useState<PageState>(
    oobCode ? "verifying" : "invalid"
  );
  const [accountEmail, setAccountEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!oobCode) return;

    if (!isFirebaseConfigured() || !auth) {
      setPageState("invalid");
      return;
    }

    let cancelled = false;

    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        if (cancelled) return;
        setAccountEmail(email);
        setPageState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setPageState("invalid");
      });

    return () => {
      cancelled = true;
    };
  }, [oobCode]);

  const fieldMotion = (i: number) => ({
    custom: i,
    variants: fieldVariants,
    initial: reduceMotion ? false : ("hidden" as const),
    animate: reduceMotion ? false : ("show" as const),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!auth) {
      toast.error("Firebase is not configured.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setPageState("success");
      toast.success("Password updated successfully");
      setTimeout(() => router.push("/login"), 2400);
    } catch (error) {
      toast.error(getResetErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const maskedEmail =
    accountEmail && accountEmail.includes("@")
      ? accountEmail.replace(/(^.).*(@.*$)/, "$1••••$2")
      : accountEmail;

  return (
    <AuthShell
      heroTitle={
        <>
          Secure your{" "}
          <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
            TradIQ
          </span>{" "}
          account
        </>
      }
      heroSubtitle="Choose a strong new password to protect your wallet, bots, and earnings."
    >
      <GlassCard glow className="relative overflow-hidden p-6 md:p-8">
        <BorderBeam />
        <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="relative z-10">
          {pageState === "verifying" && (
            <div className="flex flex-col items-center py-10 text-center">
              <span className="h-10 w-10 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-400" />
              <p className="mt-4 text-sm text-zinc-400">Verifying reset link…</p>
            </div>
          )}

          {pageState === "invalid" && (
            <motion.div
              initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              className="space-y-6 text-center"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
                <KeyRound className="h-7 w-7 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Link expired</h2>
                <p className="mt-2 text-sm text-zinc-500">
                  This password reset link is invalid, expired, or already used.
                  Request a fresh link to continue.
                </p>
              </div>
              <Link href="/forgot-password">
                <motion.button
                  type="button"
                  className="h-11 w-full rounded-lg border border-amber-500/30 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/10 cursor-pointer"
                  whileHover={reduceMotion ? undefined : { scale: 1.01 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.99 }}
                >
                  Request new reset link
                </motion.button>
              </Link>
            </motion.div>
          )}

          {pageState === "success" && (
            <motion.div
              initial={reduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
              animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
              className="space-y-6 text-center"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Password updated</h2>
                <p className="mt-2 text-sm text-zinc-500">
                  Your new password is set. Redirecting you to sign in…
                </p>
              </div>
              <Link href="/login">
                <motion.button
                  type="button"
                  className="h-11 w-full rounded-lg border border-amber-500/30 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/10 cursor-pointer"
                >
                  Go to sign in
                </motion.button>
              </Link>
            </motion.div>
          )}

          {pageState === "ready" && (
            <>
              <motion.div
                className="mb-7"
                initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
              >
                <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-amber-400" />
                  <p className="text-left text-sm text-zinc-300">
                    Resetting password for{" "}
                    <span className="font-medium text-amber-300">
                      {maskedEmail || "your account"}
                    </span>
                  </p>
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  Set new password
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Use at least 6 characters. Mix letters and numbers for strength.
                </p>
              </motion.div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <motion.div {...fieldMotion(0)}>
                  <Label className="text-zinc-400">New password</Label>
                  <div className="relative mt-1.5">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter new password"
                      autoComplete="new-password"
                      className="border-amber-500/20 bg-black/60 pl-10 pr-10 text-white transition-all placeholder:text-zinc-600 focus-visible:border-amber-500/50 focus-visible:ring-amber-500/20"
                      required
                      minLength={6}
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
                </motion.div>

                <motion.div {...fieldMotion(1)}>
                  <Label className="text-zinc-400">Confirm password</Label>
                  <div className="relative mt-1.5">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                    <Input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      autoComplete="new-password"
                      className="border-amber-500/20 bg-black/60 pl-10 pr-10 text-white transition-all placeholder:text-zinc-600 focus-visible:border-amber-500/50 focus-visible:ring-amber-500/20"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 transition-colors hover:text-amber-400 cursor-pointer"
                      aria-label={
                        showConfirm ? "Hide confirmation" : "Show confirmation"
                      }
                    >
                      {showConfirm ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </motion.div>

                <motion.div {...fieldMotion(2)}>
                  <ShimmerButton type="submit" disabled={loading}>
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                        Updating…
                      </span>
                    ) : (
                      <>
                        Update password
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
              </form>
            </>
          )}
        </div>
      </GlassCard>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell
          heroTitle="TradIQ"
          heroSubtitle="Loading secure reset form…"
        >
          <GlassCard className="flex items-center justify-center p-12">
            <span className="h-10 w-10 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-400" />
          </GlassCard>
        </AuthShell>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
