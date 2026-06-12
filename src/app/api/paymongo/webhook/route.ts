import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { fulfillPaidDeposit } from "@/lib/deposit-fulfillment";
import {
  extractPaymongoTransferId,
  syncWithdrawalTransferStatus,
} from "@/lib/console/withdrawal-transfer-webhook";
import { verifyPaymongoSignature } from "@/lib/paymongo";
import { apiError } from "@/lib/security/api-errors";
import { isProduction } from "@/lib/security/env";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("paymongo-signature");
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  let event: {
    data?: {
      id?: string;
      attributes?: {
        type?: string;
        data?: {
          id?: string;
          type?: string;
          attributes?: {
            payment_intent_id?: string;
            source?: { data?: { id?: string } };
          };
        };
      };
      transfers?: Array<{ id?: string }>;
    };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const transferId = extractPaymongoTransferId(event);
  if (transferId) {
    try {
      const synced = await syncWithdrawalTransferStatus(db, transferId);
      if (isProduction()) {
        console.info(
          `[paymongo/webhook] transfer ${transferId} callback${synced ? " synced" : " (no matching withdrawal)"}`
        );
      }
    } catch (err) {
      return apiError(
        "paymongo/webhook transfer",
        err,
        500,
        "Transfer webhook processing failed"
      );
    }
    return NextResponse.json({ received: true });
  }

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

  const eventType = event.data?.attributes?.type;
  const paymentData = event.data?.attributes?.data;

  if (eventType === "payment.paid") {
    const paymentAttrs = paymentData?.attributes;
    const intentId =
      paymentAttrs?.payment_intent_id ??
      (paymentData?.type === "payment_intent" ? paymentData.id : undefined) ??
      paymentAttrs?.source?.data?.id;

    if (!intentId) {
      console.warn("[paymongo/webhook] payment.paid missing payment_intent_id");
      return NextResponse.json({ received: true });
    }

    try {
      const synced = await fulfillPaidDeposit(db, intentId);
      if (!synced) {
        console.warn(
          `[paymongo/webhook] payment.paid not fulfilled for intent ${intentId}`
        );
      }
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
        .limit(5)
        .get();

      const depositDoc = depositSnap.docs.find(
        (doc) => doc.data().status === "pending"
      );

      if (depositDoc) {
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
