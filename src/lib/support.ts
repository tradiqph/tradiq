import { z } from "zod";

export const SUPPORT_CATEGORIES = [
  { value: "deposit", label: "Deposit issue" },
  { value: "withdrawal", label: "Withdrawal issue" },
  { value: "bot", label: "Bot subscription" },
  { value: "referral", label: "Referral program" },
  { value: "account", label: "Account & login" },
  { value: "other", label: "Other" },
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["value"];

export const SUPPORT_CATEGORY_VALUES = SUPPORT_CATEGORIES.map((c) => c.value);

export const SUPPORT_MAX_MESSAGE_LENGTH = 2000;
export const SUPPORT_MAX_SUBJECT_LENGTH = 120;
export const SUPPORT_MAX_ATTACHMENTS = 3;
export const SUPPORT_MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024; // 4 MB
export const SUPPORT_ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type SupportTicketStatus = "open" | "resolved";

export interface SupportTicketReply {
  id: string;
  authorId: string;
  authorRole: "user" | "admin";
  authorEmail?: string;
  body: string;
  createdAt: { seconds: number } | null;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  category: SupportCategory;
  categoryLabel: string;
  subject: string | null;
  message: string;
  status: SupportTicketStatus;
  attachmentPaths: string[];
  attachmentUrls: string[];
  createdAt: { seconds: number } | null;
  updatedAt: { seconds: number } | null;
  resolvedAt?: { seconds: number } | null;
  lastReplyAuthorRole?: "user" | "admin" | null;
  lastReplyPreview?: string | null;
  lastReplyAt?: { seconds: number } | null;
  userReadAt?: { seconds: number } | null;
  hasUnreadReply?: boolean;
  replies?: SupportTicketReply[];
}

export interface SupportUnreadItem {
  ticketId: string;
  categoryLabel: string;
  preview: string;
  lastReplyAt: { seconds: number } | null;
}

export interface SupportNotificationItem extends SupportUnreadItem {
  isUnread: boolean;
}

/** Strip control chars and limit length — mitigates log/HTML injection in stored text. */
export function sanitizeSupportText(input: string, maxLen: number): string {
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\uFEFF/g, "")
    .trim()
    .slice(0, maxLen);
}

export const createTicketSchema = z.object({
  category: z.enum(
    SUPPORT_CATEGORY_VALUES as [SupportCategory, ...SupportCategory[]]
  ),
  subject: z.string().max(SUPPORT_MAX_SUBJECT_LENGTH).optional(),
  message: z
    .string()
    .min(10, "Please describe your issue (at least 10 characters)")
    .max(SUPPORT_MAX_MESSAGE_LENGTH),
  attachmentPaths: z
    .array(z.string().max(256))
    .max(SUPPORT_MAX_ATTACHMENTS)
    .optional(),
});

export const adminReplySchema = z.object({
  ticketId: z.string().min(1).max(128),
  message: z
    .string()
    .min(1)
    .max(SUPPORT_MAX_MESSAGE_LENGTH),
});

export const adminResolveSchema = z.object({
  ticketId: z.string().min(1).max(128),
});

export function getCategoryLabel(value: SupportCategory): string {
  return (
    SUPPORT_CATEGORIES.find((c) => c.value === value)?.label ?? "Other"
  );
}
