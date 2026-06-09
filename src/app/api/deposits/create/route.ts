import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { verifyAuthToken } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { createQrPhPaymentIntent, isPaymongoTestMode } from "@/lib/paymongo";

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { amount } = await request.json();
  const num = Number(amount);
  if (!num || num < 100) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  try {
    const centavos = Math.round(num * 100);
    const { intentId, qrImageUrl, testUrl } =
      await createQrPhPaymentIntent(centavos);

    if (!qrImageUrl) {
      return NextResponse.json(
        { error: "Paymongo did not return a QR code" },
        { status: 502 }
      );
    }

    const depositId = randomUUID();
    const db = getAdminDb();

    if (db) {
      const expiresAt = Timestamp.fromDate(
        new Date(Date.now() + 30 * 60 * 1000)
      );

      const depositRef = db.collection("deposits").doc(depositId);
      await depositRef.set({
        userId: decoded.uid,
        amount: num,
        paymongoIntentId: intentId,
        status: "pending",
        qrImageUrl,
        expiresAt,
        createdAt: FieldValue.serverTimestamp(),
      });

      await db
        .collection("users")
        .doc(decoded.uid)
        .collection("transactions")
        .doc(depositId)
        .set({
          type: "deposit",
          amount: num,
          status: "pending",
          metadata: { paymongoIntentId: intentId, depositId },
          title: "Deposit",
          subtitle: "QR Ph — Pending payment",
          createdAt: FieldValue.serverTimestamp(),
        });
    }

    return NextResponse.json({
      qrImageUrl,
      depositId,
      intentId,
      amount: num,
      persistOnClient: !db,
      testUrl: isPaymongoTestMode() ? testUrl : null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Deposit failed" },
      { status: 500 }
    );
  }
}
