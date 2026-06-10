import { formatPeso } from "@/lib/finance";
import { PRODUCTION_APP_URL } from "@/lib/app-url";
import { maskAccountNumber } from "@/lib/withdrawal-accounts";
import type { WithdrawalAccount } from "@/types";
import {
  wrapEmailLayout,
  escapeHtml,
  emailButton,
  emailStatRow,
  emailHighlightCard,
} from "@/lib/email/layout";

export interface WithdrawalRequestEmailContent {
  subject: string;
  html: string;
  text: string;
}

export function buildWithdrawalRequestAlertEmail(params: {
  memberName: string;
  memberEmail: string;
  memberId: string;
  requestId: string;
  amount: number;
  processingFee: number;
  netPayout: number;
  requestedAt: string;
  account: WithdrawalAccount;
}): WithdrawalRequestEmailContent {
  const amountLabel = formatPeso(params.amount);
  const feeLabel = formatPeso(params.processingFee);
  const netLabel = formatPeso(params.netPayout);
  const subject = `Withdrawal request — ${params.memberName} · ${amountLabel}`;

  const maskedAccount = maskAccountNumber(
    params.account.accountType,
    params.account.accountNumber
  );
  const payoutLabel = params.account.bankName
    ? `${params.account.accountType} · ${params.account.bankName}`
    : params.account.accountType;

  const statsTable = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
${emailStatRow("Member", params.memberName)}
${emailStatRow("Email", params.memberEmail)}
${emailStatRow("Requested amount", amountLabel)}
${emailStatRow("Processing fee (4%)", feeLabel)}
${emailStatRow("Net payout", netLabel)}
${emailStatRow("Payout account", params.account.label)}
${emailStatRow("Account type", payoutLabel)}
${emailStatRow("Account number", maskedAccount)}
${emailStatRow("Account name", params.account.accountName)}
${emailStatRow("Date & time", params.requestedAt)}
</table>`;

  const consoleLink = `${PRODUCTION_APP_URL}/console/withdrawals`;

  const bodyHtml = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
<tr>
<td style="background-color:#1c1917;border-left:4px solid #f59e0b;padding-top:14px;padding-bottom:14px;padding-left:16px;padding-right:16px;">
<p style="margin:0;font-size:12px;line-height:18px;color:#fbbf24;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;font-family:Inter,Arial,Helvetica,sans-serif;">New withdrawal request</p>
</td>
</tr>
</table>
<h1 style="margin:0 0 12px 0;font-size:24px;line-height:32px;font-weight:700;color:#f8fafc;font-family:Inter,Arial,Helvetica,sans-serif;">Cashout pending review</h1>
<p style="margin:0 0 20px 0;font-size:15px;line-height:24px;color:#a1a1aa;font-family:Inter,Arial,Helvetica,sans-serif;">A member submitted a withdrawal request. Review and approve it in the Console.</p>
${emailHighlightCard(`
<p style="margin:0 0 4px 0;font-size:13px;line-height:18px;color:#71717a;font-family:Inter,Arial,Helvetica,sans-serif;">Requested amount</p>
<p style="margin:0;font-size:32px;line-height:40px;font-weight:700;color:#fbbf24;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(amountLabel)}</p>
<p style="margin:8px 0 0 0;font-size:14px;line-height:22px;color:#34d399;font-family:Inter,Arial,Helvetica,sans-serif;">Net payout: <strong>${escapeHtml(netLabel)}</strong></p>
<p style="margin:12px 0 0 0;font-size:14px;line-height:22px;color:#d4d4d8;font-family:Inter,Arial,Helvetica,sans-serif;"><strong style="color:#f8fafc;">${escapeHtml(params.memberName)}</strong> · ${escapeHtml(params.memberEmail)}</p>
`)}
${statsTable}
${emailButton(consoleLink, "Review in Console")}
<p style="margin:20px 0 0 0;font-size:12px;line-height:18px;color:#52525b;font-family:Inter,Arial,Helvetica,sans-serif;">Request ID: ${escapeHtml(params.requestId)} · Member ID: ${escapeHtml(params.memberId)}</p>`;

  const html = wrapEmailLayout({
    title: subject,
    preheader: `${params.memberName} requested ${amountLabel} withdrawal — review in Console`,
    bodyHtml,
    footerNote:
      "Internal TradIQ notification — sent when a member submits a withdrawal request.",
  });

  const text = `New withdrawal request

Member: ${params.memberName}
Email: ${params.memberEmail}
Requested: ${amountLabel}
Processing fee: ${feeLabel}
Net payout: ${netLabel}
Account: ${params.account.label} (${payoutLabel})
Account number: ${maskedAccount}
Account name: ${params.account.accountName}
Date: ${params.requestedAt}

Request ID: ${params.requestId}
Member ID: ${params.memberId}

Console: ${consoleLink}

— TradIQ`;

  return { subject, html, text };
}
