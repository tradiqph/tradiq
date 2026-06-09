import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { verifyAuthToken } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { apiBadRequest, apiError } from "@/lib/security/api-errors";
import {
  checkRateLimit,
  getClientIp,
} from "@/lib/security/rate-limit";
import { pinSchema } from "@/lib/security/validation";

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
    await db.collection("users").doc(decoded.uid).update({
      securityPinHash: hash,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return apiError("account/pin", e, 500, "Failed to update PIN");
  }
}
