import { formatPeso } from "@/lib/finance";
import { PRODUCTION_APP_URL } from "@/lib/app-url";
import {
  wrapEmailLayout,
  escapeHtml,
  emailButton,
  emailStatRow,
  emailHighlightCard,
} from "@/lib/email/layout";

export interface BotInvestmentEmailContent {
  subject: string;
  html: string;
  text: string;
}

export function buildBotInvestmentAlertEmail(params: {
  memberName: string;
  memberEmail: string;
  amount: number;
  investedAt: string;
  botId?: string;
  memberId: string;
  activeBotCount?: number;
}): BotInvestmentEmailContent {
  const amountLabel = formatPeso(params.amount);
  const subject = `New bot investment — ${params.memberName} · ${amountLabel}`;

  const statsTable = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
${emailStatRow("Member", params.memberName)}
${emailStatRow("Email", params.memberEmail)}
${emailStatRow("Amount invested", amountLabel)}
${emailStatRow("Date & time", params.investedAt)}
${params.activeBotCount != null ? emailStatRow("Active bots (member)", String(params.activeBotCount)) : ""}
</table>`;

  const consoleLink = `${PRODUCTION_APP_URL}/console/members`;

  const bodyHtml = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
<tr>
<td style="background-color:#1c1917;border-left:4px solid #d4af37;padding-top:14px;padding-bottom:14px;padding-left:16px;padding-right:16px;">
<p style="margin:0;font-size:12px;line-height:18px;color:#d4af37;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;font-family:Inter,Arial,Helvetica,sans-serif;">New investment alert</p>
</td>
</tr>
</table>
<h1 style="margin:0 0 12px 0;font-size:24px;line-height:32px;font-weight:700;color:#f8fafc;font-family:Inter,Arial,Helvetica,sans-serif;">Copy Trading Bot activated</h1>
<p style="margin:0 0 20px 0;font-size:15px;line-height:24px;color:#a1a1aa;font-family:Inter,Arial,Helvetica,sans-serif;">A member just subscribed to a Copy Trading Bot on TradIQ. Details are below.</p>
${emailHighlightCard(`
<p style="margin:0 0 4px 0;font-size:13px;line-height:18px;color:#71717a;font-family:Inter,Arial,Helvetica,sans-serif;">Investment amount</p>
<p style="margin:0;font-size:32px;line-height:40px;font-weight:700;color:#d4af37;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(amountLabel)}</p>
<p style="margin:12px 0 0 0;font-size:14px;line-height:22px;color:#d4d4d8;font-family:Inter,Arial,Helvetica,sans-serif;"><strong style="color:#f8fafc;">${escapeHtml(params.memberName)}</strong> · ${escapeHtml(params.memberEmail)}</p>
`)}
${statsTable}
${emailButton(consoleLink, "View members in Console")}
<p style="margin:20px 0 0 0;font-size:12px;line-height:18px;color:#52525b;font-family:Inter,Arial,Helvetica,sans-serif;">Member ID: ${escapeHtml(params.memberId)}${params.botId ? ` · Bot ID: ${escapeHtml(params.botId)}` : ""}</p>`;

  const html = wrapEmailLayout({
    title: subject,
    preheader: `${params.memberName} invested ${amountLabel} in a Copy Trading Bot`,
    bodyHtml,
    footerNote:
      "Internal TradIQ notification — sent to administrators when a member activates a bot.",
  });

  const text = `New Copy Trading Bot investment

Member: ${params.memberName}
Email: ${params.memberEmail}
Amount: ${amountLabel}
Date: ${params.investedAt}
${params.activeBotCount != null ? `Active bots: ${params.activeBotCount}\n` : ""}
Member ID: ${params.memberId}${params.botId ? `\nBot ID: ${params.botId}` : ""}

Console: ${consoleLink}

— TradIQ`;

  return { subject, html, text };
}
