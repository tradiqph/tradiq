import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { apiBadRequest, apiError } from "@/lib/security/api-errors";
import {
  checkRateLimit,
  getClientIp,
} from "@/lib/security/rate-limit";
import { displayNameSchema } from "@/lib/security/validation";

export async function PATCH(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  const adminAuth = getAdminAuth();
  if (!db || !adminAuth) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit({
    scope: "account-profile",
    key: `${decoded.uid}:${ip}`,
    limit: 10,
    windowSec: 300,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many profile update attempts" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiBadRequest("Invalid JSON body");
  }

  const displayNameRaw =
    typeof body === "object" && body !== null && "displayName" in body
      ? (body as { displayName: unknown }).displayName
      : undefined;

  const parsed = displayNameSchema.safeParse(displayNameRaw);
  if (!parsed.success) {
    return apiBadRequest(
      parsed.error.issues[0]?.message ?? "Invalid display name"
    );
  }

  const displayName = parsed.data;

  try {
    const userRef = db.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await userRef.update({ displayName });
    await adminAuth.updateUser(decoded.uid, { displayName });

    return NextResponse.json({ displayName });
  } catch (e) {
    return apiError("account/profile", e, 500, "Failed to update display name");
  }
}
