import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { fulfillPaidDeposit } from "@/lib/deposit-fulfillment";
import { verifyPaymongoSignature } from "@/lib/paymongo";
import { apiError } from "@/lib/security/api-errors";
import { isProduction } from "@/lib/security/env";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("paymongo-signature");
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[paymongo/webhook] PAYMONGO_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 }
    );
  }

  if (!verifyPaymongoSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  let event: {
    data?: {
      attributes?: {
        type?: string;
        data?: {
          attributes?: {
            payment_intent_id?: string;
            source?: { data?: { id?: string } };
          };
        };
      };
    };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const eventType = event.data?.attributes?.type;
  const paymentData = event.data?.attributes?.data;

  if (eventType === "payment.paid") {
    const intentId =
      paymentData?.attributes?.payment_intent_id ??
      paymentData?.attributes?.source?.data?.id;

    if (!intentId) {
      return NextResponse.json({ received: true });
    }

    try {
      await fulfillPaidDeposit(db, intentId);
    } catch (err) {
      return apiError("paymongo/webhook", err, 500, "Webhook processing failed");
    }
  }

  if (eventType === "qrph.expired" || eventType === "payment.failed") {
    const intentId = paymentData?.attributes?.payment_intent_id;
    if (!intentId) {
      return NextResponse.json({ received: true });
    }

    try {
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
    } catch (err) {
      return apiError("paymongo/webhook", err, 500, "Webhook processing failed");
    }
  }

  if (isProduction()) {
    console.info("[paymongo/webhook] processed", eventType ?? "unknown");
  }

  return NextResponse.json({ received: true });
}
