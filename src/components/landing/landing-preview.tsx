import Image from "next/image";
import { Check } from "lucide-react";

const highlights = [
  "Real-time wallet & deposit balance tracking",
  "Smart Wallet Engine with elite bot catalog",
  "Multi-level referral program (15% / 3% / 2% / 1% / 1%)",
  "QR Ph deposits with Paymongo integration",
  "Secure PIN protection for withdrawals",
  "Mobile-first glassmorphism design",
];

export function LandingPreview() {
  return (
    <section id="preview" className="py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 md:grid-cols-2 md:px-8">
        <div className="relative">
          <div className="absolute -inset-8 rounded-full bg-amber-500/5 blur-3xl" />
          <Image
            src="/assets/landing-app-preview.png"
            alt="TradIQ app screens"
            width={700}
            height={500}
            className="relative rounded-2xl"
          />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">
            App Preview
          </p>
          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">
            Built for mobile. Designed for trust.
          </h2>
          <p className="mt-4 text-zinc-400">
            TradIQ delivers a premium black-and-gold experience with
            glassmorphism UI, intuitive navigation, and all the tools you need —
            right in your pocket.
          </p>
          <ul className="mt-8 space-y-3">
            {highlights.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-zinc-300">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
                  <Check className="h-3 w-3 text-amber-400" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
