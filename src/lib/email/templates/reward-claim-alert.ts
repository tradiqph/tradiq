import { formatPeso } from "@/lib/finance";
import { PRODUCTION_APP_URL } from "@/lib/app-url";
import {
  wrapEmailLayout,
  escapeHtml,
  emailButton,
  emailStatRow,
  emailHighlightCard,
} from "@/lib/email/layout";
import { formatDeliveryAddress } from "@/lib/rewards/config";

export interface RewardClaimAlertEmailContent {
  subject: string;
  html: string;
  text: string;
}

export function buildRewardClaimAlertEmail(params: {
  referenceNumber: string;
  memberName: string;
  memberEmail: string;
  memberPhone: string;
  rewardName: string;
  rewardValue: number;
  deliveryAddress: {
    street: string;
    barangay: string;
    city: string;
    postalCode: string;
  };
  claimedAt: string;
  status: string;
}): RewardClaimAlertEmailContent {
  const subject = "🎁 New Reward Claim Submitted";
  const addressBlock = formatDeliveryAddress(params.deliveryAddress);
  const rewardValueLabel = formatPeso(params.rewardValue);

  const statsTable = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
${emailStatRow("Reference", params.referenceNumber)}
${emailStatRow("Reward", params.rewardName)}
${emailStatRow("Reward value", rewardValueLabel)}
${emailStatRow("Member", params.memberName)}
${emailStatRow("Email", params.memberEmail)}
${emailStatRow("Phone", params.memberPhone)}
${emailStatRow("Address", addressBlock.replace(/\n/g, "<br>"))}
${emailStatRow("Claim date", params.claimedAt)}
${emailStatRow("Status", params.status)}
</table>`;

  const consoleLink = `${PRODUCTION_APP_URL}/console/rewards`;

  const bodyHtml = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
<tr>
<td style="background-color:#1c1917;border-left:4px solid #f59e0b;padding-top:14px;padding-bottom:14px;padding-left:16px;padding-right:16px;">
<p style="margin:0;font-size:12px;line-height:18px;color:#fbbf24;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;font-family:Inter,Arial,Helvetica,sans-serif;">New reward claim</p>
</td>
</tr>
</table>
<h1 style="margin:0 0 12px 0;font-size:24px;line-height:32px;font-weight:700;color:#f8fafc;font-family:Inter,Arial,Helvetica,sans-serif;">Reward claim pending review</h1>
<p style="margin:0 0 20px 0;font-size:15px;line-height:24px;color:#a1a1aa;font-family:Inter,Arial,Helvetica,sans-serif;">A member submitted a reward claim. Review and fulfill it in the Console.</p>
${emailHighlightCard(`
<p style="margin:0 0 4px 0;font-size:13px;line-height:18px;color:#71717a;font-family:Inter,Arial,Helvetica,sans-serif;">Reference</p>
<p style="margin:0;font-size:24px;line-height:32px;font-weight:700;color:#fbbf24;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(params.referenceNumber)}</p>
<p style="margin:12px 0 0 0;font-size:14px;line-height:22px;color:#d4d4d8;font-family:Inter,Arial,Helvetica,sans-serif;"><strong style="color:#f8fafc;">${escapeHtml(params.rewardName)}</strong></p>
<p style="margin:8px 0 0 0;font-size:14px;line-height:22px;color:#d4d4d8;font-family:Inter,Arial,Helvetica,sans-serif;"><strong style="color:#f8fafc;">${escapeHtml(params.memberName)}</strong> · ${escapeHtml(params.memberEmail)}</p>
`)}
${statsTable}
${emailButton(consoleLink, "Review in Console")}`;

  const html = wrapEmailLayout({
    title: subject,
    preheader: `${params.memberName} claimed ${params.rewardName} — ${params.referenceNumber}`,
    bodyHtml,
    footerNote:
      "Internal TradIQ notification — sent when a member submits a reward claim.",
  });

  const text = `New Reward Claim Submitted

Reference: ${params.referenceNumber}
Reward: ${params.rewardName}
Reward value: ${rewardValueLabel}

Member: ${params.memberName}
Email: ${params.memberEmail}
Phone: ${params.memberPhone}

Address:
${addressBlock}

Claim date: ${params.claimedAt}
Status: ${params.status}

Console: ${consoleLink}

— TradIQ`;

  return { subject, html, text };
}
