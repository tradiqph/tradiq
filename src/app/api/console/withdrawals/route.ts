import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import { serializeDoc } from "@/lib/console/serialize";
import {
  checkRateLimit,
  getClientIp,
} from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const status = request.nextUrl.searchParams.get("status") ?? "pending";

  let query = auth.db.collection("withdrawalRequests") as FirebaseFirestore.Query;
  if (status !== "all") {
    query = query.where("status", "==", status);
  }
  const snap = await query.orderBy("createdAt", "desc").get();

  const requests = snap.docs.map((d) =>
    serializeDoc({ id: d.id, ...d.data() })
  );
  return NextResponse.json({ requests });
}

async function findWithdrawalTransaction(
  db: FirebaseFirestore.Firestore,
  userId: string,
  requestId: string,
  amount: number
) {
  const byRequestId = await db
    .collection("users")
    .doc(userId)
    .collection("transactions")
    .where("metadata.withdrawalRequestId", "==", requestId)
    .limit(1)
    .get();

  if (!byRequestId.empty) return byRequestId.docs[0];

  const legacy = await db
    .collection("users")
    .doc(userId)
    .collection("transactions")
    .where("type", "==", "withdrawal")
    .where("status", "==", "pending")
    .where("amount", "==", amount)
    .limit(1)
    .get();

  return legacy.empty ? null : legacy.docs[0];
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
  if (!requestId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const reqRef = auth.db.collection("withdrawalRequests").doc(requestId);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists || reqSnap.data()?.status !== "pending") {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const reqData = reqSnap.data()!;
  const userId = reqData.userId as string;
  const amount = reqData.amount as number;
  const netPayout = (reqData.netPayout as number | undefined) ?? amount;

  if (action === "approve") {
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
  } else {
    await auth.db.runTransaction(async (tx) => {
      const userRef = auth.db.collection("users").doc(userId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw new Error("User not found");

      tx.update(userRef, {
        walletBalance: FieldValue.increment(amount),
      });

      tx.update(reqRef, {
        status: "rejected",
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
        status: "rejected",
        subtitle: "Rejected · balance refunded",
      });
    }
  }

  return NextResponse.json({ success: true });
}
