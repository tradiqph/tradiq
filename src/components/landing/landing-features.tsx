import Image from "next/image";
import { GlassCard } from "@/components/ui/glass-card";
import { marketingGutter } from "@/lib/marketing-layout";

const features = [
  {
    image: "/assets/landing-feature-bots.png",
    title: "Copy Trading Bots",
    description:
      "Subscribe to Smart Wallet Engine bots that auto-calibrate to elite wallets. Earn up to 3% daily on your active subscriptions.",
    highlight: "3% DAILY",
  },
  {
    image: "/assets/landing-feature-deposits.png",
    title: "QR Ph Deposits",
    description:
      "Fund your account instantly via QR Ph using any Philippine bank or e-wallet. Secure payments powered by Paymongo.",
    highlight: "INSTANT",
  },
  {
    image: "/assets/landing-feature-referral.png",
    title: "Referral Rewards",
    description:
      "Invite friends and earn up to 7% commission on their bot subscriptions across 5 referral levels.",
    highlight: "7% L1",
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="py-20 md:py-28">
      <div className={marketingGutter}>
        <div className="mb-14 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">
            Features
          </p>
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">
            Everything you need to invest smarter
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
            A complete fintech platform with wallet management, automated bots,
            and a rewarding referral network.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {features.map((feature) => (
            <GlassCard
              key={feature.title}
              glow
              className="group overflow-hidden transition-transform hover:-translate-y-1"
            >
              <div className="relative h-48 overflow-hidden">
                <Image
                  src={feature.image}
                  alt={feature.title}
                  fill
                  className="object-cover opacity-90 transition-transform group-hover:scale-105"
                />
                <span className="absolute right-4 top-4 rounded-full border border-amber-400/50 bg-black/60 px-3 py-1 text-xs font-bold text-amber-400 backdrop-blur">
                  {feature.highlight}
                </span>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {feature.description}
                </p>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
}
