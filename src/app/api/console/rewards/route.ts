import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import { paginateByCursor, parseConsoleListLimit } from "@/lib/console/pagination";
import { sendRewardShippedEmail } from "@/lib/email/send";
import {
  claimInDateRange,
  claimMatchesSearch,
  fetchRewardClaimHistory,
  fetchRewardClaimSummary,
  serializeRewardClaim,
  updateRewardClaimStatus,
} from "@/lib/rewards/claims-server";
import {
  isRewardClaimStatus,
  isRewardType,
  type RewardClaimStatus,
} from "@/lib/rewards/config";
import {
  checkRateLimit,
  getClientIp,
} from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const params = request.nextUrl.searchParams;
  const statusParam = params.get("status") ?? "all";
  const rewardTypeParam = params.get("rewardType") ?? "all";
  const search = params.get("search") ?? "";
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");
  const cursor = params.get("cursor");
  const limit = parseConsoleListLimit(params.get("limit"));
  const claimId = params.get("claimId");

  if (claimId) {
    const claimSnap = await auth.db
      .collection("reward_claims")
      .doc(claimId)
      .get();
    if (!claimSnap.exists) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }
    const history = await fetchRewardClaimHistory(auth.db, claimId);
    return NextResponse.json({
      claim: serializeRewardClaim(claimId, claimSnap.data() ?? {}),
      history,
    });
  }

  let query = auth.db.collection("reward_claims") as FirebaseFirestore.Query;

  if (statusParam !== "all" && isRewardClaimStatus(statusParam)) {
    query = query.where("status", "==", statusParam);
  }

  if (rewardTypeParam !== "all" && isRewardType(rewardTypeParam)) {
    query = query.where("rewardType", "==", rewardTypeParam);
  }

  const snap = await query.orderBy("claimedAt", "desc").get();
  const summary = await fetchRewardClaimSummary(auth.db);

  let claims = snap.docs.map((doc) =>
    serializeRewardClaim(doc.id, doc.data())
  );

  if (search.trim()) {
    claims = claims.filter((claim) => claimMatchesSearch(claim, search));
  }

  if (dateFrom || dateTo) {
    claims = claims.filter((claim) =>
      claimInDateRange(claim, dateFrom, dateTo)
    );
  }

  const paginated = paginateByCursor(claims, cursor, limit);

  return NextResponse.json({
    claims: paginated.page,
    summary,
    total: paginated.total,
    pageSize: limit,
    hasMore: paginated.hasMore,
    nextCursor: paginated.nextCursor,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit({
    scope: "console-rewards-patch",
    key: `${auth.decoded.uid}:${ip}`,
    limit: 30,
    windowSec: 60,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  let body: {
    claimId?: string;
    status?: RewardClaimStatus;
    courier?: string;
    trackingNumber?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.claimId || !body.status || !isRewardClaimStatus(body.status)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const result = await updateRewardClaimStatus(auth.db, {
      claimId: body.claimId,
      status: body.status,
      adminUid: auth.decoded.uid,
      courier: body.courier,
      trackingNumber: body.trackingNumber,
    });

    if (result.sendShipmentEmail && result.claim.memberEmail) {
      try {
        const emailResult = await sendRewardShippedEmail({
          to: result.claim.memberEmail,
          memberName: result.claim.memberName,
          rewardName: result.claim.rewardName,
          referenceNumber: result.claim.referenceNumber,
          courier: result.claim.courier,
          trackingNumber: result.claim.trackingNumber,
        });
        if (!emailResult.ok) {
          console.warn(
            "[console/rewards] shipment email not sent:",
            emailResult.error
          );
        }
      } catch (emailErr) {
        console.warn("[console/rewards] shipment email failed:", emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      claim: result.claim,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    const status = message === "Claim not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
