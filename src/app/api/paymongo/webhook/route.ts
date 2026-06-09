import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { fulfillPaidDeposit } from "@/lib/deposit-fulfillment";
import { verifyPaymongoSignature } from "@/lib/paymongo";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("paymongo-signature");
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

  if (webhookSecret && !verifyPaymongoSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const event = JSON.parse(rawBody);
  const eventType = event.data?.attributes?.type;
  const paymentData = event.data?.attributes?.data;

  if (eventType === "payment.paid") {
    const intentId =
      paymentData?.attributes?.payment_intent_id ??
      paymentData?.attributes?.source?.data?.id;

    if (!intentId) {
      return NextResponse.json({ received: true });
    }

    await fulfillPaidDeposit(db, intentId);
  }

  if (eventType === "qrph.expired" || eventType === "payment.failed") {
    const intentId = paymentData?.attributes?.payment_intent_id;
    if (!intentId) {
      return NextResponse.json({ received: true });
    }

    const depositSnap = await db
      .collection("deposits")
      .where("paymongoIntentId", "==", intentId)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (!depositSnap.empty) {
      const depositDoc = depositSnap.docs[0];
      const userId = depositDoc.data().userId as string;
      await depositDoc.ref.update({ status: "expired" });

      const txSnap = await db
        .collection("users")
        .doc(userId)
        .collection("transactions")
        .where("metadata.paymongoIntentId", "==", intentId)
        .limit(1)
        .get();

      if (!txSnap.empty) {
        await txSnap.docs[0].ref.update({
          status: "expired",
          subtitle: "Expired",
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
