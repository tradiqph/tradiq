import {
  wrapEmailLayout,
  escapeHtml,
  emailButton,
} from "@/lib/email/layout";

export interface PasswordResetEmailContent {
  subject: string;
  html: string;
  text: string;
}

export function buildPasswordResetEmail(params: {
  displayName?: string;
  resetLink: string;
}): PasswordResetEmailContent {
  const greeting = params.displayName
    ? `Hi ${params.displayName},`
    : "Hi there,";

  const bodyHtml = `
<h1 style="margin:0 0 12px 0;font-size:24px;line-height:32px;font-weight:700;color:#f8fafc;font-family:Inter,Arial,Helvetica,sans-serif;">Reset your password</h1>
<p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:#a1a1aa;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(greeting)}</p>
<p style="margin:0 0 8px 0;font-size:15px;line-height:24px;color:#d4d4d8;font-family:Inter,Arial,Helvetica,sans-serif;">We received a request to reset the password for your TradIQ account. Tap the button below to choose a new password.</p>
<p style="margin:0 0 8px 0;font-size:14px;line-height:22px;color:#71717a;font-family:Inter,Arial,Helvetica,sans-serif;">This link expires in 1 hour. If you did not request a reset, you can safely ignore this email — your password will stay the same.</p>
${emailButton(params.resetLink, "Reset password")}
<p style="margin:24px 0 0 0;font-size:13px;line-height:20px;color:#52525b;font-family:Inter,Arial,Helvetica,sans-serif;">Button not working? Copy and paste this link into your browser:</p>
<p style="margin:8px 0 0 0;font-size:12px;line-height:18px;color:#d4af37;word-break:break-all;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(params.resetLink)}</p>`;

  const html = wrapEmailLayout({
    title: "Reset your TradIQ password",
    preheader: "Reset your TradIQ password — link expires in 1 hour",
    bodyHtml,
    footerNote:
      "This is an automated security message from TradIQ. Please do not reply to this email.",
  });

  const text = `${greeting}

We received a request to reset the password for your TradIQ account.

Reset your password: ${params.resetLink}

This link expires in 1 hour. If you did not request a reset, you can ignore this email.

— TradIQ`;

  return {
    subject: "Reset your TradIQ password",
    html,
    text,
  };
}
