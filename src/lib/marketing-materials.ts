export interface MarketingMaterial {
  id: string;
  title: string;
  description: string;
  filename: string;
  href: string;
}

export const MARKETING_MATERIALS: MarketingMaterial[] = [
  {
    id: "platform-showcase",
    title: "Platform Showcase",
    description:
      "Copy trading bots dashboard and earnings history — perfect for social posts and onboarding.",
    filename: "tradiq-platform-showcase.png",
    href: "/assets/marketing/platform-showcase.png",
  },
  {
    id: "referral-commission",
    title: "Referral & Commission",
    description:
      "5-level referral program — 15% / 3% / 2% / 1% / 1% commission tiers.",
    filename: "tradiq-referral-commission.png",
    href: "/assets/marketing/referral-commission.png",
  },
  {
    id: "3-percent-daily",
    title: "3% Daily Returns",
    description:
      "Highlight daily bot earnings and Smart Wallet Engine performance.",
    filename: "tradiq-3-percent-daily.png",
    href: "/assets/marketing/3-percent-daily.png",
  },
];

export async function downloadMarketingMaterial(
  material: MarketingMaterial
): Promise<void> {
  const res = await fetch(material.href);
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = material.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function downloadAllMarketingMaterials(): Promise<void> {
  for (const material of MARKETING_MATERIALS) {
    await downloadMarketingMaterial(material);
    await new Promise((r) => setTimeout(r, 400));
  }
}
