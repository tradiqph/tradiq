"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Eye,
  EyeOff,
  Gift,
  Loader2,
  Lock,
  Mail,
  User,
  UserPlus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/ui/glass-card";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { AuthShell } from "@/components/auth/auth-shell";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isValidReferralCode } from "@/lib/security/validation";

function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referralFromLink, setReferralFromLink] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ref = searchParams.get("ref")?.trim();
    if (ref && isValidReferralCode(ref)) {
      setReferralCode(ref.toUpperCase());
      setReferralFromLink(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    try {
      const code = referralCode.trim().toUpperCase();
      await register(email, password, displayName, code || undefined);
      router.push("/home");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Registration failed";
      toast.error(message);
      setLoading(false);
    }
  };

  return (
    <GlassCard glow className="relative overflow-hidden p-6 md:p-8">
      <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />

      {loading && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-zinc-950/90 px-6 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-label="Creating account"
        >
          <div className="relative flex h-14 w-14 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-amber-500/20" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
              <Loader2 className="h-7 w-7 animate-spin text-amber-400" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-white">
              Creating your account...
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {referralCode
                ? "Securing your profile and applying your referral link"
                : "This only takes a moment — please don’t close this page"}
            </p>
          </div>
        </div>
      )}

      <div className="relative">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-600/30 to-yellow-500/10">
            <UserPlus className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Create Account</h2>
            <p className="text-sm text-zinc-500">Start your investment journey</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className={cn("space-y-4", loading && "pointer-events-none")}
          aria-busy={loading}
        >
          <div>
            <Label className="text-zinc-400">Display Name</Label>
            <div className="relative mt-1.5">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="border-amber-500/20 bg-black/60 pl-10 text-white placeholder:text-zinc-600 focus-visible:border-amber-500/50"
                disabled={loading}
                required
              />
            </div>
          </div>
          <div>
            <Label className="text-zinc-400">Email</Label>
            <div className="relative mt-1.5">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="border-amber-500/20 bg-black/60 pl-10 text-white placeholder:text-zinc-600 focus-visible:border-amber-500/50"
                disabled={loading}
                required
              />
            </div>
          </div>
          <div>
            <Label className="text-zinc-400">Password</Label>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                minLength={6}
                className="border-amber-500/20 bg-black/60 pl-10 pr-10 text-white placeholder:text-zinc-600 focus-visible:border-amber-500/50"
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 transition-colors hover:text-amber-400 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          <div>
            <Label className="text-zinc-400">Referral Code</Label>
            <div className="relative mt-1.5">
              <Gift className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
              <Input
                value={referralCode}
                onChange={(e) => {
                  setReferralFromLink(false);
                  setReferralCode(e.target.value.toUpperCase());
                }}
                placeholder="Optional — enter referrer's code"
                className={cn(
                  "border-amber-500/20 bg-black/60 pl-10 text-white uppercase placeholder:normal-case placeholder:text-zinc-600 focus-visible:border-amber-500/50",
                  referralFromLink && "border-amber-500/40 bg-amber-500/5"
                )}
                disabled={loading}
              />
            </div>
            {referralFromLink && referralCode && (
              <p className="mt-1.5 text-xs text-amber-400">
                Applied from your invite link
              </p>
            )}
          </div>
          <ShimmerButton type="submit" disabled={loading} className="h-11">
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating account...
              </span>
            ) : (
              "Register"
            )}
          </ShimmerButton>
        </form>

        <p className="mt-5 text-center text-sm text-zinc-500">
          Have an account?{" "}
          <Link
            href="/login"
            className={cn(
              "text-amber-400 hover:underline",
              loading && "pointer-events-none opacity-50"
            )}
          >
            Sign In
          </Link>
        </p>
      </div>
    </GlassCard>
  );
}

export default function RegisterPage() {
  return (
    <AuthShell
      heroTitle={
        <>
          Join{" "}
          <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
            TradIQ
          </span>{" "}
          today
        </>
      }
      heroSubtitle="Create your account to unlock AI copy-trading bots, instant QR Ph deposits, and earn through our referral program."
    >
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
