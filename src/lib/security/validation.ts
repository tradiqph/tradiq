import { z } from "zod";
import {
  WITHDRAWAL_MIN_AMOUNT,
  WITHDRAWAL_MAX_AMOUNT,
  DEPOSIT_MIN_AMOUNT,
  DEPOSIT_MAX_AMOUNT,
  BOT_MIN_AMOUNT,
  BOT_MAX_AMOUNT,
} from "@/lib/finance";

export const referralCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^TRD-[A-Z]{1,6}-\d{4}$/, "Invalid referral code format");

export const pinSchema = z
  .string()
  .regex(/^\d{4,6}$/, "PIN must be 4-6 digits");

export const depositAmountSchema = z
  .number()
  .finite()
  .min(DEPOSIT_MIN_AMOUNT, `Minimum deposit is ₱${DEPOSIT_MIN_AMOUNT}`)
  .max(DEPOSIT_MAX_AMOUNT, `Maximum deposit is ₱${DEPOSIT_MAX_AMOUNT}`);

export const botAmountSchema = z
  .number()
  .finite()
  .min(BOT_MIN_AMOUNT, `Minimum bot subscription is ₱${BOT_MIN_AMOUNT}`)
  .max(BOT_MAX_AMOUNT, `Maximum bot subscription is ₱${BOT_MAX_AMOUNT}`);

export const withdrawalAmountSchema = z
  .number()
  .finite()
  .min(WITHDRAWAL_MIN_AMOUNT)
  .max(WITHDRAWAL_MAX_AMOUNT);

export const intentIdSchema = z.string().min(1).max(128);

export function parseJsonBody<T>(
  schema: z.ZodType<T>,
  body: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const msg = result.error.issues[0]?.message ?? "Invalid request body";
    return { success: false, error: msg };
  }
  return { success: true, data: result.data };
}
