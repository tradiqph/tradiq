import { PRODUCTION_APP_URL } from "@/lib/app-url";

const LOGO_URL = `${PRODUCTION_APP_URL}/assets/logo-tradiq.png`;

export interface EmailLayoutOptions {
  preheader?: string;
  title: string;
  bodyHtml: string;
  footerNote?: string;
}

export function wrapEmailLayout(opts: EmailLayoutOptions): string {
  const preheader = opts.preheader ?? opts.title;
  const footerNote =
    opts.footerNote ??
    "You received this email because of activity on your TradIQ account.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:Inter,Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#000000;">
<tr>
<td align="center" style="padding-top:40px;padding-bottom:40px;padding-left:16px;padding-right:16px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#09090b;border:1px solid #3f3a2e;">
<tr>
<td align="center" style="padding-top:32px;padding-bottom:24px;padding-left:24px;padding-right:24px;border-bottom:1px solid #3f3a2e;">
<img src="${LOGO_URL}" alt="TradIQ" width="120" height="40" border="0" style="display:block;width:120px;height:auto;max-width:120px;" />
</td>
</tr>
<tr>
<td style="padding-top:32px;padding-bottom:32px;padding-left:32px;padding-right:32px;">
${opts.bodyHtml}
</td>
</tr>
<tr>
<td style="padding-top:24px;padding-bottom:32px;padding-left:32px;padding-right:32px;border-top:1px solid #3f3a2e;">
<p style="margin:0;font-size:12px;line-height:20px;color:#71717a;text-align:center;">${escapeHtml(footerNote)}</p>
<p style="margin:8px 0 0 0;font-size:12px;line-height:20px;color:#52525b;text-align:center;">
<a href="${PRODUCTION_APP_URL}" style="color:#d4af37;text-decoration:none;">tradiq.biz</a>
</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function emailButton(href: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;margin-bottom:8px;">
<tr>
<td align="center" bgcolor="#d4af37" style="background-color:#d4af37;border-radius:8px;">
<a href="${href}" style="display:inline-block;padding-top:14px;padding-bottom:14px;padding-left:32px;padding-right:32px;font-size:15px;font-weight:600;line-height:20px;color:#000000;text-decoration:none;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(label)}</a>
</td>
</tr>
</table>`;
}

export function emailStatRow(label: string, value: string): string {
  return `<tr>
<td style="padding-top:12px;padding-bottom:12px;padding-left:16px;padding-right:16px;border-bottom:1px solid #27272a;">
<p style="margin:0;font-size:13px;line-height:18px;color:#a1a1aa;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(label)}</p>
</td>
<td align="right" style="padding-top:12px;padding-bottom:12px;padding-left:16px;padding-right:16px;border-bottom:1px solid #27272a;">
<p style="margin:0;font-size:15px;line-height:22px;color:#f8fafc;font-weight:600;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(value)}</p>
</td>
</tr>`;
}

export function emailHighlightCard(contentHtml: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;margin-bottom:8px;background-color:#18181b;border:1px solid #3f3a2e;">
<tr>
<td style="padding-top:20px;padding-bottom:20px;padding-left:20px;padding-right:20px;">
${contentHtml}
</td>
</tr>
</table>`;
}
