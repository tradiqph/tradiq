import { NextRequest, NextResponse } from "next/server";
import type { Auth } from "firebase-admin/auth";
import { z } from "zod";
import { buildBrandedPasswordResetLink } from "@/lib/auth/password-reset-link";
import { getAdminAuth } from "@/lib/firebase/admin";
import { sendPasswordResetEmail } from "@/lib/email/send";
import { isResendConfigured } from "@/lib/email/config";
import { apiBadRequest, apiError } from "@/lib/security/api-errors";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

const bodySchema = z.object({
  email: z.string().email("Enter a valid email address").max(254),
});

const GENERIC_SUCCESS =
  "If an account exists for that email, we sent password reset instructions.";

async function createPasswordResetLink(
  adminAuth: Auth,
  email: string
): Promise<string> {
  const firebaseLink = await adminAuth.generatePasswordResetLink(email);
  return buildBrandedPasswordResetLink(firebaseLink);
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rate = checkRateLimit({
    scope: "auth/forgot-password",
    key: ip,
    limit: 5,
    windowSec: 15 * 60,
  });

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      }
    );
  }

  if (!isResendConfigured()) {
    return NextResponse.json(
      { error: "Password reset email is not configured." },
      { status: 503 }
    );
  }

  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiBadRequest("Invalid JSON body");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiBadRequest(parsed.error.issues[0]?.message ?? "Invalid email");
  }

  const email = parsed.data.email.trim().toLowerCase();

  try {
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
    } catch {
      return NextResponse.json({ success: true, message: GENERIC_SUCCESS });
    }

    const resetLink = await createPasswordResetLink(adminAuth, email);

    const result = await sendPasswordResetEmail({
      to: email,
      displayName: userRecord.displayName ?? undefined,
      resetLink,
    });

    if (!result.ok) {
      return apiError(
        "auth/forgot-password",
        new Error(result.error ?? "send failed"),
        500,
        "Could not send reset email. Please try again later."
      );
    }

    return NextResponse.json({ success: true, message: GENERIC_SUCCESS });
  } catch (e) {
    return apiError(
      "auth/forgot-password",
      e,
      500,
      "Could not process password reset. Please try again later."
    );
  }
}
