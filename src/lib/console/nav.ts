import {
  LayoutDashboard,
  Wallet,
  Users,
  TrendingUp,
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
    label: "Investments",
    shortLabel: "Invest",
    icon: TrendingUp,
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
