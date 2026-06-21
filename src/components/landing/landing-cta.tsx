import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GoldButton } from "@/components/ui/gold-button";
import { GlassCard } from "@/components/ui/glass-card";
import { marketingGutter } from "@/lib/marketing-layout";

export function LandingCta() {
  return (
    <section className="pb-20 md:pb-28">
      <div className={marketingGutter}>
        <GlassCard glow className="relative overflow-hidden p-10 text-center md:p-14">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent" />
          <div className="relative">
            <h2 className="text-3xl font-bold text-white md:text-4xl">
              Ready to start your journey?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-zinc-400">
              Join TradIQ today. Create your account, deposit via QR Ph, and let
              our copy-trading bots work for you.
            </p>
            <Link href="/register" className="mt-8 inline-block">
              <GoldButton className="h-12 px-10 text-base">
                Create Free Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </GoldButton>
            </Link>
          </div>
        </GlassCard>
      </div>
    </section>
  );
}
