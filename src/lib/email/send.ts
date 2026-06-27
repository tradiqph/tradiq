import { Resend } from "resend";
import type { Firestore } from "firebase-admin/firestore";
import {
  getResendApiKey,
  getResendFromAddress,
  getAdminNotificationRecipients,
  isResendConfigured,
} from "@/lib/email/config";
import { buildPasswordResetEmail } from "@/lib/email/templates/password-reset";
import { buildBotInvestmentAlertEmail } from "@/lib/email/templates/bot-investment";
import { buildWithdrawalRequestAlertEmail } from "@/lib/email/templates/withdrawal-request";
import { buildRewardClaimAlertEmail } from "@/lib/email/templates/reward-claim-alert";
import { buildRewardShippedEmail } from "@/lib/email/templates/reward-shipped";
import type { WithdrawalAccount } from "@/types";
import type { RewardDeliveryAddress } from "@/types";

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (resendClient) return resendClient;
  const apiKey = getResendApiKey();
  if (!apiKey) return null;
  resendClient = new Resend(apiKey);
  return resendClient;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  tags?: { name: string; value: string }[];
}): Promise<SendEmailResult> {
  const client = getResendClient();
  if (!client) {
    console.warn("[email] RESEND_API_KEY not configured — email not sent");
    return { ok: false, error: "Email not configured" };
  }

  const to = Array.isArray(params.to) ? params.to : [params.to];

  try {
    const { data, error } = await client.emails.send({
      from: getResendFromAddress(),
      to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      tags: params.tags,
    });

    if (error) {
      console.error("[email] Resend error:", error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true, id: data?.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Send failed";
    console.error("[email] Send failed:", message);
    return { ok: false, error: message };
  }
}

export async function sendPasswordResetEmail(params: {
  to: string;
  displayName?: string;
  resetLink: string;
}): Promise<SendEmailResult> {
  if (!isResendConfigured()) {
    return { ok: false, error: "Email not configured" };
  }

  const content = buildPasswordResetEmail({
    displayName: params.displayName,
    resetLink: params.resetLink,
  });

  return sendEmail({
    to: params.to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    tags: [{ name: "category", value: "password_reset" }],
  });
}

export async function sendBotInvestmentAlert(params: {
  db: Firestore | null;
  memberId: string;
  memberName: string;
  memberEmail: string;
  amount: number;
  investedAt: Date;
  botId?: string;
  activeBotCount?: number;
}): Promise<SendEmailResult> {
  if (!isResendConfigured()) {
    return { ok: false, error: "Email not configured" };
  }

  const recipients = await getAdminNotificationRecipients(params.db);
  if (recipients.length === 0) {
    console.warn(
      "[email] No admin notification recipients — set ADMIN_NOTIFICATION_EMAILS or add super_admin users"
    );
    return { ok: false, error: "No notification recipients" };
  }

  const investedAtLabel = params.investedAt.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const content = buildBotInvestmentAlertEmail({
    memberId: params.memberId,
    memberName: params.memberName,
    memberEmail: params.memberEmail,
    amount: params.amount,
    investedAt: investedAtLabel,
    botId: params.botId,
    activeBotCount: params.activeBotCount,
  });

  return sendEmail({
    to: recipients,
    subject: content.subject,
    html: content.html,
    text: content.text,
    tags: [
      { name: "category", value: "bot_investment" },
      { name: "member_id", value: params.memberId },
    ],
  });
}

export async function sendWithdrawalRequestAlert(params: {
  db: Firestore | null;
  memberId: string;
  memberName: string;
  memberEmail: string;
  requestId: string;
  amount: number;
  processingFee: number;
  netPayout: number;
  requestedAt: Date;
  account: WithdrawalAccount;
}): Promise<SendEmailResult> {
  if (!isResendConfigured()) {
    return { ok: false, error: "Email not configured" };
  }

  const recipients = await getAdminNotificationRecipients(params.db);
  if (recipients.length === 0) {
    console.warn("[email] No admin notification recipients configured");
    return { ok: false, error: "No notification recipients" };
  }

  const requestedAtLabel = params.requestedAt.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const content = buildWithdrawalRequestAlertEmail({
    memberId: params.memberId,
    memberName: params.memberName,
    memberEmail: params.memberEmail,
    requestId: params.requestId,
    amount: params.amount,
    processingFee: params.processingFee,
    netPayout: params.netPayout,
    requestedAt: requestedAtLabel,
    account: params.account,
  });

  return sendEmail({
    to: recipients,
    subject: content.subject,
    html: content.html,
    text: content.text,
    tags: [
      { name: "category", value: "withdrawal_request" },
      { name: "member_id", value: params.memberId },
      { name: "request_id", value: params.requestId },
    ],
  });
}

export async function sendRewardClaimAlert(params: {
  db: Firestore | null;
  memberId: string;
  memberName: string;
  memberEmail: string;
  memberPhone: string;
  referenceNumber: string;
  rewardName: string;
  rewardValue: number;
  deliveryAddress: RewardDeliveryAddress;
  claimedAt: Date;
}): Promise<SendEmailResult> {
  if (!isResendConfigured()) {
    return { ok: false, error: "Email not configured" };
  }

  const recipients = await getAdminNotificationRecipients(params.db);
  if (recipients.length === 0) {
    console.warn("[email] No admin notification recipients configured");
    return { ok: false, error: "No notification recipients" };
  }

  const claimedAtLabel = params.claimedAt.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const content = buildRewardClaimAlertEmail({
    referenceNumber: params.referenceNumber,
    memberName: params.memberName,
    memberEmail: params.memberEmail,
    memberPhone: params.memberPhone,
    rewardName: params.rewardName,
    rewardValue: params.rewardValue,
    deliveryAddress: params.deliveryAddress,
    claimedAt: claimedAtLabel,
    status: "Pending",
  });

  return sendEmail({
    to: recipients,
    subject: content.subject,
    html: content.html,
    text: content.text,
    tags: [
      { name: "category", value: "reward_claim" },
      { name: "member_id", value: params.memberId },
      { name: "reference", value: params.referenceNumber },
    ],
  });
}

export async function sendRewardShippedEmail(params: {
  to: string;
  memberName: string;
  rewardName: string;
  referenceNumber: string;
  courier?: string;
  trackingNumber?: string;
}): Promise<SendEmailResult> {
  if (!isResendConfigured()) {
    return { ok: false, error: "Email not configured" };
  }

  if (!params.to.includes("@")) {
    return { ok: false, error: "Invalid recipient email" };
  }

  const content = buildRewardShippedEmail({
    memberName: params.memberName,
    rewardName: params.rewardName,
    referenceNumber: params.referenceNumber,
    courier: params.courier,
    trackingNumber: params.trackingNumber,
  });

  return sendEmail({
    to: params.to,
    subject: content.subject,
    html: content.html,
    text: content.text,
    tags: [
      { name: "category", value: "reward_shipped" },
      { name: "reference", value: params.referenceNumber },
    ],
  });
}
