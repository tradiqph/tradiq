import { Wallet, Bot, TrendingUp, Banknote } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { marketingGutter } from "@/lib/marketing-layout";

const steps = [
  {
    icon: Wallet,
    step: "01",
    title: "Create Account",
    description: "Sign up in seconds with your email. Get your unique TRD referral code instantly.",
  },
  {
    icon: Banknote,
    step: "02",
    title: "Deposit via QR Ph",
    description: "Add funds using QR Ph — scan, pay, and your deposit balance updates automatically.",
  },
  {
    icon: Bot,
    step: "03",
    title: "Subscribe to Bots",
    description: "Allocate your deposit balance to copy-trading bots and start earning 3% daily returns.",
  },
  {
    icon: TrendingUp,
    step: "04",
    title: "Earn & Withdraw",
    description: "Watch earnings grow in your wallet. Request withdrawals anytime to your saved accounts.",
  },
];

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="border-y border-amber-500/10 bg-zinc-950/50 py-20 md:py-28">
      <div className={marketingGutter}>
        <div className="mb-14 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">
            How It Works
          </p>
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">
            Start earning in 4 simple steps
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, step, title, description }) => (
            <GlassCard key={step} className="relative p-6">
              <span className="text-4xl font-bold text-amber-500/20">{step}</span>
              <div className="mt-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
                <Icon className="h-6 w-6 text-amber-400" />
              </div>
              <h3 className="mt-4 font-bold text-white">{title}</h3>
              <p className="mt-2 text-sm text-zinc-400">{description}</p>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
}
