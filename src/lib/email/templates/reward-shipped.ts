import { PRODUCTION_APP_URL } from "@/lib/app-url";
import {
  wrapEmailLayout,
  escapeHtml,
  emailButton,
  emailStatRow,
  emailHighlightCard,
} from "@/lib/email/layout";

export interface RewardShippedEmailContent {
  subject: string;
  html: string;
  text: string;
}

export function buildRewardShippedEmail(params: {
  memberName: string;
  rewardName: string;
  referenceNumber: string;
  courier?: string;
  trackingNumber?: string;
}): RewardShippedEmailContent {
  const subject = "📦 Your TradIQ Reward Has Been Shipped";
  const courier = params.courier?.trim() || "—";
  const trackingNumber = params.trackingNumber?.trim() || "—";

  const statsTable = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
${emailStatRow("Reference", params.referenceNumber)}
${emailStatRow("Reward", params.rewardName)}
${emailStatRow("Courier", courier)}
${emailStatRow("Tracking number", trackingNumber)}
</table>`;

  const rewardsLink = `${PRODUCTION_APP_URL}/rewards`;

  const bodyHtml = `
<h1 style="margin:0 0 12px 0;font-size:24px;line-height:32px;font-weight:700;color:#f8fafc;font-family:Inter,Arial,Helvetica,sans-serif;">Your reward is on the way</h1>
<p style="margin:0 0 20px 0;font-size:15px;line-height:24px;color:#a1a1aa;font-family:Inter,Arial,Helvetica,sans-serif;">Hi ${escapeHtml(params.memberName)}, great news — your TradIQ reward has been shipped.</p>
${emailHighlightCard(`
<p style="margin:0 0 4px 0;font-size:13px;line-height:18px;color:#71717a;font-family:Inter,Arial,Helvetica,sans-serif;">Reward</p>
<p style="margin:0;font-size:22px;line-height:30px;font-weight:700;color:#fbbf24;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(params.rewardName)}</p>
<p style="margin:12px 0 0 0;font-size:14px;line-height:22px;color:#d4d4d8;font-family:Inter,Arial,Helvetica,sans-serif;">Reference: <strong style="color:#f8fafc;">${escapeHtml(params.referenceNumber)}</strong></p>
`)}
${statsTable}
${emailButton(rewardsLink, "View Rewards Center")}`;

  const html = wrapEmailLayout({
    title: subject,
    preheader: `Your ${params.rewardName} has been shipped`,
    bodyHtml,
    footerNote:
      "You received this email because your TradIQ reward claim was marked as shipped.",
  });

  const text = `Your TradIQ Reward Has Been Shipped

Hi ${params.memberName},

Your reward is on the way.

Reference: ${params.referenceNumber}
Reward: ${params.rewardName}
Courier: ${courier}
Tracking number: ${trackingNumber}

View Rewards Center: ${rewardsLink}

— TradIQ`;

  return { subject, html, text };
}
