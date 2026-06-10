import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { verifyAuthToken } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { apiBadRequest, apiError } from "@/lib/security/api-errors";
import { userHasSecurityPin } from "@/lib/security/pin";
import {
  checkRateLimit,
  getClientIp,
} from "@/lib/security/rate-limit";
import { pinSchema } from "@/lib/security/validation";

export async function GET(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  try {
    const userRef = db.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const data = userSnap.data()!;
    const pinSet = userHasSecurityPin(data);

    if (pinSet && data.hasSecurityPin !== true) {
      await userRef.update({ hasSecurityPin: true });
    }

    return NextResponse.json({ pinSet });
  } catch (e) {
    return apiError("account/pin", e, 500, "Failed to load PIN status");
  }
}

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit({
    scope: "account-pin",
    key: `${decoded.uid}:${ip}`,
    limit: 5,
    windowSec: 300,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many PIN update attempts" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const userRef = db.collection("users").doc(decoded.uid);
  const existingSnap = await userRef.get();
  if (!existingSnap.exists) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (userHasSecurityPin(existingSnap.data())) {
    return NextResponse.json(
      {
        error:
          "A security PIN is already set on this account. Contact support if you forgot your PIN.",
      },
      { status: 409 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiBadRequest("Invalid JSON body");
  }

  const pin =
    typeof body === "object" && body !== null && "pin" in body
      ? (body as { pin: unknown }).pin
      : undefined;

  const parsed = pinSchema.safeParse(pin);
  if (!parsed.success) {
    return apiBadRequest(parsed.error.issues[0]?.message ?? "Invalid PIN");
  }

  try {
    const hash = await bcrypt.hash(parsed.data, 12);
    await userRef.update({
      securityPinHash: hash,
      hasSecurityPin: true,
    });

    return NextResponse.json({ success: true, pinSet: true });
  } catch (e) {
    return apiError("account/pin", e, 500, "Failed to update PIN");
  }
}
