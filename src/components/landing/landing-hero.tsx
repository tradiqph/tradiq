import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { GoldButton } from "@/components/ui/gold-button";
import { marketingGutter } from "@/lib/marketing-layout";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-16 md:pt-36 md:pb-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-20 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-amber-500/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-yellow-600/5 blur-[80px]" />
      </div>

      <div
        className={`${marketingGutter} relative grid items-center gap-12 lg:grid-cols-2 lg:gap-16 xl:gap-20`}
      >
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-sm text-amber-400">
            <Sparkles className="h-4 w-4" />
            Smart Investment Platform
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl">
            Grow Your Wealth with{" "}
            <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
              AI Copy Trading
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-400 lg:max-w-2xl">
            TradIQ combines automated copy-trading bots, instant QR Ph deposits,
            and a multi-level referral program — all in one premium mobile
            experience built for Filipino investors.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/register">
              <GoldButton className="h-12 px-8 text-base">
                Start Investing
                <ArrowRight className="ml-2 h-4 w-4" />
              </GoldButton>
            </Link>
            <Link href="/login">
              <button
                type="button"
                className="h-12 rounded-lg border border-amber-500/30 px-8 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/10 cursor-pointer"
              >
                I have an account
              </button>
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-3 gap-4 border-t border-amber-500/10 pt-8">
            {[
              { value: "3%", label: "Daily Returns" },
              { value: "95.9%", label: "Avg Win Rate" },
              { value: "QR Ph", label: "Instant Deposits" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-bold text-amber-400">{stat.value}</p>
                <p className="text-xs text-zinc-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:ml-auto lg:max-w-xl xl:max-w-2xl">
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-amber-500/20 to-transparent blur-2xl" />
          <Image
            src="/assets/landing-hero.png"
            alt="TradIQ app on mobile"
            width={600}
            height={600}
            className="relative rounded-2xl"
            priority
          />
        </div>
      </div>
    </section>
  );
}
