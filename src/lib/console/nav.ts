import {
  LayoutDashboard,
  Wallet,
  Users,
  TrendingUp,
  Gift,
  Network,
  FileText,
  Headphones,
  type LucideIcon,
} from "lucide-react";

export type ConsoleNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  exact?: boolean;
};

export const consoleNavItems: ConsoleNavItem[] = [
  {
    href: "/console",
    label: "Dashboard",
    shortLabel: "Home",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/console/withdrawals",
    label: "Withdrawals",
    shortLabel: "Withdraw",
    icon: Wallet,
  },
  {
    href: "/console/members",
    label: "Members",
    shortLabel: "Members",
    icon: Users,
  },
  {
    href: "/console/investments",
    label: "Bot Investments",
    shortLabel: "Bots",
    icon: TrendingUp,
  },
  {
    href: "/console/commissions",
    label: "Commissions",
    shortLabel: "Commish",
    icon: Gift,
  },
  {
    href: "/console/referral-network",
    label: "Referral Network",
    shortLabel: "Network",
    icon: Network,
  },
  {
    href: "/console/reports",
    label: "Reports",
    shortLabel: "Reports",
    icon: FileText,
  },
  {
    href: "/console/support",
    label: "Support",
    shortLabel: "Support",
    icon: Headphones,
  },
];
