import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import { serializeDoc } from "@/lib/console/serialize";
import {
  enrichWithdrawalForApi,
  getMostRecentFailedAttemptSeconds,
  withdrawalHasFailedAttemptOnDate,
} from "@/lib/console/payout-attempts";
import { syncWithdrawalTransfersForDocs, withdrawalDocNeedsPayoutSync } from "@/lib/console/withdrawal-transfer-webhook";
import {
  isActionablePayoutFailure,
  withdrawalMatchesSearch,
  type WithdrawalListItem,
} from "@/lib/console/withdrawals-list";
import {
  refundWithdrawalBalance,
  findWithdrawalTransaction,
  WithdrawalRefundError,
} from "@/lib/console/withdrawal-refund";
import {
  manilaTodayKey,
  parsePayoutDayParam,
} from "@/lib/manila-time";
import { manilaDayBounds } from "@/lib/support-tickets";
import {
  checkRateLimit,
  getClientIp,
} from "@/lib/security/rate-limit";

type SerializedWithdrawal = WithdrawalListItem;

const SYNC_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

async function fetchFailedWithdrawals(
  db: FirebaseFirestore.Firestore,
  dateKey: string
): Promise<SerializedWithdrawal[]> {
  const cutoffMs = Date.now() - SYNC_LOOKBACK_MS;

  let snap = await db
    .collection("withdrawalRequests")
    .orderBy("createdAt", "desc")
    .limit(500)
    .get();

  const docsNeedingSync = snap.docs.filter((doc) =>
    withdrawalDocNeedsPayoutSync(doc.data(), cutoffMs)
  );

  if (docsNeedingSync.length > 0) {
    await syncWithdrawalTransfersForDocs(db, docsNeedingSync, cutoffMs, {
      maxSync: 20,
    });

    snap = await db
      .collection("withdrawalRequests")
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();
  }

  return snap.docs
    .map((d) =>
      enrichWithdrawalForApi(
        d.id,
        d.data() as Record<string, unknown>,
        dateKey
      ) as unknown as SerializedWithdrawal
    )
    .filter((request) => withdrawalHasFailedAttemptOnDate(request, dateKey))
    .sort(
      (a, b) =>
        getMostRecentFailedAttemptSeconds(b.payoutAttempts ?? [], dateKey) -
        getMostRecentFailedAttemptSeconds(a.payoutAttempts ?? [], dateKey)
    );
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const params = request.nextUrl.searchParams;
  const status = params.get("status") ?? "pending";
  const search = params.get("search") ?? "";
  const date =
    parsePayoutDayParam(params.get("date")) ?? manilaTodayKey();
  const { start, end } = manilaDayBounds(date);

  let requests: SerializedWithdrawal[];

  if (status === "failed") {
    requests = await fetchFailedWithdrawals(auth.db, date);
  } else {
    let query = auth.db.collection("withdrawalRequests") as FirebaseFirestore.Query;
    if (status !== "all") {
      query = query
        .where("status", "==", status)
        .where("createdAt", ">=", start)
        .where("createdAt", "<", end);
    } else {
      query = query
        .where("createdAt", ">=", start)
        .where("createdAt", "<", end);
    }

    let snap = await query.orderBy("createdAt", "desc").get();

    if (status === "approved") {
      await syncWithdrawalTransfersForDocs(
        auth.db,
        snap.docs,
        Date.now() - SYNC_LOOKBACK_MS,
        { maxSync: 20 }
      );
      snap = await query.orderBy("createdAt", "desc").get();
    }

    requests = snap.docs.map((d) => {
      const enriched = enrichWithdrawalForApi(
        d.id,
        d.data() as Record<string, unknown>,
        status === "approved" ? date : undefined
      );
      return serializeDoc(enriched as Record<string, unknown>) as unknown as SerializedWithdrawal;
    });

    if (status === "pending") {
      requests = requests.filter((request) => !isActionablePayoutFailure(request));
    }
  }

  if (search.trim()) {
    requests = requests.filter((request) =>
      withdrawalMatchesSearch(request, search)
    );
  }

  return NextResponse.json({ requests });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit({
    scope: "console-withdrawals-patch",
    key: `${auth.decoded.uid}:${ip}`,
    limit: 20,
    windowSec: 60,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const { requestId, action } = await request.json();
  if (
    !requestId ||
    !["approve", "reject", "refund", "moveToApproved", "acknowledgePayout"].includes(
      action
    )
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const reqRef = auth.db.collection("withdrawalRequests").doc(requestId);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const reqData = reqSnap.data()!;
  const requestStatus = reqData.status as string;

  if (action === "approve" || action === "reject" || action === "moveToApproved") {
    if (requestStatus !== "pending") {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
  } else if (action === "acknowledgePayout") {
    if (requestStatus !== "approved") {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
  } else if (action === "refund") {
    if (requestStatus !== "pending" && requestStatus !== "approved") {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
  }
  const userId = reqData.userId as string;
  const amount = reqData.amount as number;
  const netPayout = (reqData.netPayout as number | undefined) ?? amount;

  if (action === "approve") {
    if (reqData.paymongoTransferStatus === "failed") {
      return NextResponse.json(
        { error: "Cannot approve a request with a failed payout" },
        { status: 409 }
      );
    }

    await auth.db.runTransaction(async (tx) => {
      const userRef = auth.db.collection("users").doc(userId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw new Error("User not found");

      tx.update(userRef, {
        totalWithdrawn: FieldValue.increment(amount),
      });

      tx.update(reqRef, {
        status: "approved",
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: auth.decoded.uid,
      });
    });

    const txDoc = await findWithdrawalTransaction(
      auth.db,
      userId,
      requestId,
      amount
    );

    if (txDoc) {
      await txDoc.ref.update({
        status: "approved",
        subtitle: `Approved · ₱${netPayout.toLocaleString("en-PH", { minimumFractionDigits: 2 })} sent`,
      });
    }
  } else if (action === "moveToApproved") {
    if (reqData.paymongoTransferStatus !== "failed") {
      return NextResponse.json(
        { error: "Move to Approved is only for failed payouts" },
        { status: 409 }
      );
    }

    await auth.db.runTransaction(async (tx) => {
      const userRef = auth.db.collection("users").doc(userId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw new Error("User not found");

      tx.update(userRef, {
        totalWithdrawn: FieldValue.increment(amount),
      });

      tx.update(reqRef, {
        status: "approved",
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: auth.decoded.uid,
      });
    });

    const txDoc = await findWithdrawalTransaction(
      auth.db,
      userId,
      requestId,
      amount
    );

    if (txDoc) {
      await txDoc.ref.update({
        status: "approved",
        subtitle: `Approved · ₱${netPayout.toLocaleString("en-PH", { minimumFractionDigits: 2 })} sent`,
      });
    }
  } else if (action === "acknowledgePayout") {
    if (reqData.payoutFailureAcknowledgedAt) {
      return NextResponse.json(
        { error: "Payout failure already acknowledged" },
        { status: 409 }
      );
    }

    if (!isActionablePayoutFailure(reqData)) {
      return NextResponse.json(
        { error: "No unresolved payout failure to acknowledge" },
        { status: 400 }
      );
    }

    await reqRef.update({
      paymongoTransferStatus: "succeeded",
      payError: FieldValue.delete(),
      payoutFailedAt: FieldValue.delete(),
      payoutFailureAcknowledgedAt: FieldValue.serverTimestamp(),
      payoutFailureAcknowledgedBy: auth.decoded.uid,
    });

    const txDoc = await findWithdrawalTransaction(
      auth.db,
      userId,
      requestId,
      amount
    );

    if (txDoc) {
      await txDoc.ref.update({
        status: "approved",
        subtitle: `Approved · ₱${netPayout.toLocaleString("en-PH", { minimumFractionDigits: 2 })} sent`,
      });
    }
  } else if (action === "refund") {
    try {
      await refundWithdrawalBalance(auth.db, {
        requestId,
        adminUid: auth.decoded.uid,
        rejectionReason: "payout_failed",
        requirePayoutFailure: true,
      });
    } catch (err) {
      if (err instanceof WithdrawalRefundError) {
        const status =
          err.code === "not_found"
            ? 404
            : err.code === "conflict"
              ? 409
              : 400;
        return NextResponse.json({ error: err.message }, { status });
      }
      throw err;
    }
  } else {
    try {
      await refundWithdrawalBalance(auth.db, {
        requestId,
        adminUid: auth.decoded.uid,
        rejectionReason: "admin_rejected",
      });
    } catch (err) {
      if (err instanceof WithdrawalRefundError) {
        const status =
          err.code === "not_found"
            ? 404
            : err.code === "conflict"
              ? 409
              : 400;
        return NextResponse.json({ error: err.message }, { status });
      }
      throw err;
    }
  }

  return NextResponse.json({ success: true });
}
