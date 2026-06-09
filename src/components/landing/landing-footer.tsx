import Image from "next/image";
import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-amber-500/10 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 md:flex-row md:px-8">
        <div className="flex items-center gap-3">
          <Image
            src="/assets/logo-tradiq.png"
            alt="TradIQ"
            width={100}
            height={28}
            className="h-7 w-auto opacity-80"
          />
        </div>
        <p className="text-sm text-zinc-600">
          © {new Date().getFullYear()} TradIQ. All rights reserved.
        </p>
        <div className="flex gap-6 text-sm text-zinc-500">
          <Link href="/login" className="hover:text-amber-400 transition-colors">
            Sign In
          </Link>
          <Link href="/register" className="hover:text-amber-400 transition-colors">
            Register
          </Link>
        </div>
      </div>
    </footer>
  );
}
