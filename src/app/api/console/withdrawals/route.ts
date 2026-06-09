import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import { serializeDoc } from "@/lib/console/serialize";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  if (action === "approve") {
    await auth.db.runTransaction(async (tx) => {
      const userRef = auth.db.collection("users").doc(userId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw new Error("User not found");
      const balance = userSnap.data()?.walletBalance ?? 0;
      if (balance < amount) throw new Error("Insufficient balance");

      tx.update(userRef, {
        walletBalance: FieldValue.increment(-amount),
        totalWithdrawn: FieldValue.increment(amount),
      });

      tx.update(reqRef, {
        status: "approved",
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: auth.decoded.uid,
      });
    });

    const txSnap = await auth.db
      .collection("users")
      .doc(userId)
      .collection("transactions")
      .where("type", "==", "withdrawal")
      .where("status", "==", "pending")
      .where("amount", "==", amount)
      .limit(1)
      .get();

    if (!txSnap.empty) {
      await txSnap.docs[0].ref.update({
        status: "approved",
        subtitle: "Approved",
      });
    }
  } else {
    await reqRef.update({
      status: "rejected",
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: auth.decoded.uid,
    });

    const txSnap = await auth.db
      .collection("users")
      .doc(userId)
      .collection("transactions")
      .where("type", "==", "withdrawal")
      .where("status", "==", "pending")
      .where("amount", "==", amount)
      .limit(1)
      .get();

    if (!txSnap.empty) {
      await txSnap.docs[0].ref.update({
        status: "rejected",
        subtitle: "Rejected",
      });
    }
  }

  return NextResponse.json({ success: true });
}
