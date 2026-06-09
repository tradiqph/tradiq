import Image from "next/image";
import Link from "next/link";
import { GoldButton } from "@/components/ui/gold-button";

export function LandingNav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-amber-500/10 bg-black/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/assets/logo-tradiq.png"
            alt="TradIQ"
            width={240}
            height={160}
            className="h-10 w-auto sm:h-12"
            priority
          />
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
          <a href="#features" className="hover:text-amber-400 transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="hover:text-amber-400 transition-colors">
            How It Works
          </a>
          <a href="#preview" className="hover:text-amber-400 transition-colors">
            Preview
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-sm text-zinc-300 hover:text-white sm:block"
          >
            Sign In
          </Link>
          <Link href="/register">
            <GoldButton size="sm" className="px-5">
              Get Started
            </GoldButton>
          </Link>
        </div>
      </div>
    </header>
  );
}
