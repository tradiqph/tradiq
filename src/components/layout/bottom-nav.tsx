"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Clock, Gift, Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  {
    href: "/home",
    label: "Home",
    icon: Home,
    imageSrc: "/assets/nav-home-coin.png",
    exact: true,
  },
  {
    href: "/history",
    label: "History",
    icon: Clock,
    imageSrc: "/assets/nav-history-coin.png",
  },
  {
    href: "/bot",
    label: "Bot",
    icon: Bot,
    imageSrc: "/assets/smart-wallet-engine.png",
    isCenter: true,
  },
  {
    href: "/referral",
    label: "Referral",
    icon: Gift,
    imageSrc: "/assets/nav-referral-coin.png",
  },
  {
    href: "/account",
    label: "Account",
    icon: User,
    imageSrc: "/assets/nav-account-coin.png",
  },
] as const;

function CoinIcon({
  imageSrc,
  FallbackIcon,
  active,
  size,
}: {
  imageSrc: string;
  FallbackIcon: React.ComponentType<{ className?: string }>;
  active: boolean;
  size: number;
}) {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <FallbackIcon
        className={cn(
          "text-amber-400",
          size >= 44 ? "h-6 w-6" : "h-5 w-5"
        )}
      />
    );
  }

  return (
    <Image
      src={imageSrc}
      alt=""
      width={size}
      height={size}
      className="h-full w-full object-cover"
      onError={() => setImgError(true)}
    />
  );
}

export function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <nav
      className="fixed inset-x-0 bottom-4 z-50 px-4"
      aria-label="Main navigation"
    >
      <div className="dock-shadow mx-auto flex w-full max-w-md flex-row items-end justify-between rounded-2xl border border-amber-500/15 bg-zinc-950/95 px-2 py-2.5 backdrop-blur-xl">
        {tabs.map(({ href, label, icon, imageSrc, exact, isCenter }) => {
          const active = isActive(href, exact);
          const coinSize = isCenter ? 48 : 40;

          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1",
                isCenter && "motion-safe-lift -mt-4"
              )}
            >
              <div
                className={cn(
                  "relative shrink-0 overflow-hidden rounded-full border-2 bg-zinc-900",
                  isCenter ? "h-12 w-12" : "h-10 w-10",
                  active
                    ? "border-amber-400 shadow-[0_0_14px_rgba(212,175,55,0.5)]"
                    : "border-amber-600/40 shadow-[0_0_6px_rgba(212,175,55,0.15)]"
                )}
              >
                <CoinIcon
                  imageSrc={imageSrc}
                  FallbackIcon={icon}
                  active={active}
                  size={coinSize}
                />
              </div>
              <span
                className={cn(
                  "w-full truncate text-center text-[10px] font-medium leading-none",
                  active ? "text-amber-400" : "text-zinc-500"
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
