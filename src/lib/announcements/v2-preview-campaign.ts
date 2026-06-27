import { MANILA_TZ } from "@/lib/manila-time";

export const V2_PREVIEW_CAMPAIGN_ID = "v2-preview-2026";
export const V2_PREVIEW_SESSION_KEY = "tradiq_v2_preview_shown";

/** Jun 27, 2026 11:59 PM Philippine Time */
export const V2_PREVIEW_END_AT = new Date("2026-06-27T23:59:59+08:00");

export type V2PreviewSlideVisual =
  | "pioneer"
  | "leaderboard"
  | "rewards"
  | "ranks";

export interface V2PreviewSlide {
  id: string;
  title: string;
  subtitle: string;
  bullets?: string[];
  visual: V2PreviewSlideVisual;
  imageSrc: string;
  showCountdown?: boolean;
  footer?: string;
}

export const V2_PREVIEW_SLIDES: V2PreviewSlide[] = [
  {
    id: "pioneer",
    title: "Pioneer Privilege Ending",
    subtitle:
      "Direct referral drops from 15% to 7% when the pioneer period ends on Jun 27, 2026.",
    bullets: [
      "Lock in pioneer rates before the deadline",
      "Build your network while L1 stays at 15%",
    ],
    visual: "pioneer",
    imageSrc: "/assets/announcements/v2-preview/slide-1-pioneer-genz.png",
    showCountdown: true,
    footer: "After pioneer: 7% direct · L2–5: 3%, 2%, 1%, 1%",
  },
  {
    id: "leaderboard",
    title: "Team Leaderboard",
    subtitle:
      "Weekly cycle Sun 00:00 – Sat 23:59 (Asia/Manila). Compete in Personal Investment and Group Sales.",
    bullets: [
      "Weekly Personal Investment — Top 3 win ₱5,000 / ₱3,000 / ₱1,000",
      "Weekly Group Sales — Top 3 win ₱5,000 / ₱3,000 / ₱1,000",
    ],
    visual: "leaderboard",
    imageSrc: "/assets/announcements/v2-preview/slide-2-leaderboard-genz.png",
  },
  {
    id: "rewards",
    title: "Rewards Update",
    subtitle: "Unlock milestone rewards as your group sales grow.",
    bullets: [
      "₱500,000 group sales → iPhone 14 Pro Max 256GB",
      "₱1,000,000 group sales → iPhone 17 Pro Max 256GB",
      "₱2,000,000 group sales → Yamaha Aerox or Nmax latest model",
    ],
    visual: "rewards",
    imageSrc: "/assets/announcements/v2-preview/slide-3-rewards-genz.png",
  },
  {
    id: "ranks",
    title: "Rank System",
    subtitle: "Climb the ranks and unlock higher daily bot rates for 30 days.",
    bullets: [
      "Leader — 1.0% daily · ₱10K personal · 10 active refs @ ₱10K · ₱110K group",
      "Director — 1.2% daily · 20 active refs @ ₱10K · ₱1M group sales",
      "Ambassador — 1.5% daily · 30 active refs @ ₱10K · ₱2M group sales",
    ],
    visual: "ranks",
    imageSrc: "/assets/announcements/v2-preview/slide-4-ranks-genz.png",
    footer: "Coming in TradIQ V2",
  },
];

export function isV2PreviewCampaignActive(_now: Date = new Date()): boolean {
  return false;
}

export function getV2PreviewTimeRemaining(now: Date = new Date()): number | null {
  if (!isV2PreviewCampaignActive(now)) return null;
  return Math.max(0, V2_PREVIEW_END_AT.getTime() - now.getTime());
}

export function formatV2PreviewCountdown(ms: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

export function formatV2PreviewDeadlineLabel(): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(V2_PREVIEW_END_AT);
}

export function clearV2PreviewSessionFlag(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(V2_PREVIEW_SESSION_KEY);
}

export function hasV2PreviewBeenShownThisSession(): boolean {
  if (typeof window === "undefined") return true;
  return sessionStorage.getItem(V2_PREVIEW_SESSION_KEY) === "1";
}

export function markV2PreviewShownThisSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(V2_PREVIEW_SESSION_KEY, "1");
}
