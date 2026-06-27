import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { sendRewardClaimAlert } from "@/lib/email/send";
import { submitRewardClaim } from "@/lib/rewards/claims-server";
import { rewardClaimSchema } from "@/lib/rewards/validation";
import { apiBadRequest, apiError } from "@/lib/security/api-errors";
import { isProduction } from "@/lib/security/env";
import {
  checkRateLimit,
  getClientIp,
} from "@/lib/security/rate-limit";
import { parseJsonBody } from "@/lib/security/validation";

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    if (isProduction()) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit({
    scope: "rewards-claim",
    key: `${decoded.uid}:${ip}`,
    limit: 5,
    windowSec: 300,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many claim attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiBadRequest("Invalid JSON body");
  }

  const parsed = parseJsonBody(rewardClaimSchema, body);
  if (!parsed.success) {
    return apiBadRequest(parsed.error);
  }

  try {
    const result = await submitRewardClaim(db, decoded.uid, parsed.data);

    try {
      const notifyResult = await sendRewardClaimAlert({
        db,
        memberId: decoded.uid,
        memberName: result.memberName,
        memberEmail: result.memberEmail,
        memberPhone: result.memberPhone,
        referenceNumber: result.referenceNumber,
        rewardName: result.rewardName,
        rewardValue: result.rewardValue,
        deliveryAddress: result.deliveryAddress,
        claimedAt: result.claimedAt,
      });
      if (!notifyResult.ok) {
        console.warn(
          "[rewards/claim] admin notification not sent:",
          notifyResult.error
        );
      }
    } catch (notifyErr) {
      console.warn("[rewards/claim] admin notification failed:", notifyErr);
    }

    return NextResponse.json({
      success: true,
      referenceNumber: result.referenceNumber,
      status: result.status,
      claimId: result.claimId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (
      message === "User not found" ||
      message === "This reward has already been claimed" ||
      message === "Reward requirements not met"
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return apiError("rewards/claim", e, 500, "Failed to submit reward claim");
  }
}
