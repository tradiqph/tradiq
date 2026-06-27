import { z } from "zod";
import {
  isRewardType,
  REWARD_TYPE_IDS,
  type RewardType,
} from "@/lib/rewards/config";

export const rewardDeliveryAddressSchema = z.object({
  street: z
    .string()
    .trim()
    .min(3, "Street address is required (include landmarks)")
    .max(200),
  barangay: z.string().trim().min(2, "Barangay is required").max(100),
  city: z.string().trim().min(2, "City is required").max(100),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Postal code must be 4 digits"),
});

export const rewardClaimSchema = z.object({
  rewardType: z
    .string()
    .refine((v) => isRewardType(v), "Invalid reward type"),
  confirmation: z.literal("TRADIQ", {
    message: 'Type "TRADIQ" to confirm',
  }),
  memberName: z.string().trim().min(2, "Full name is required").max(120),
  memberEmail: z.string().trim().email("Enter a valid email address"),
  memberPhone: z
    .string()
    .trim()
    .regex(/^(\+63|0)?9\d{9}$/, "Enter a valid Philippine mobile number"),
  deliveryAddress: rewardDeliveryAddressSchema,
});

export type RewardClaimInput = z.infer<typeof rewardClaimSchema>;

export function normalizePhilippinePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length === 12) {
    return `0${digits.slice(2)}`;
  }
  if (digits.startsWith("9") && digits.length === 10) {
    return `0${digits}`;
  }
  return digits;
}

export function isValidRewardTypeFilter(value: string | null): value is RewardType | "all" {
  return value === "all" || (value !== null && REWARD_TYPE_IDS.includes(value as RewardType));
}
