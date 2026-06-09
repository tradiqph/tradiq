import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { verifyAuthToken } from "@/lib/api-auth";
import { validateDepositAmount } from "@/lib/finance";
import { getAdminDb } from "@/lib/firebase/admin";
import { createQrPhPaymentIntent, isPaymongoTestMode } from "@/lib/paymongo";
import { apiBadRequest, apiError } from "@/lib/security/api-errors";
import { isProduction } from "@/lib/security/env";
import {
  checkRateLimit,
  getClientIp,
} from "@/lib/security/rate-limit";

async function persistDepositServerSide(
  db: Firestore,
  decodedUid: string,
  depositId: string,
  amount: number,
  intentId: string,
  qrImageUrl: string
) {
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000));

  const depositRef = db.collection("deposits").doc(depositId);
  await depositRef.set({
    userId: decodedUid,
    amount,
    paymongoIntentId: intentId,
    status: "pending",
    qrImageUrl,
    expiresAt,
    createdAt: FieldValue.serverTimestamp(),
  });

  await db
    .collection("users")
    .doc(decodedUid)
    .collection("transactions")
    .doc(depositId)
    .set({
      type: "deposit",
      amount,
      status: "pending",
      metadata: { paymongoIntentId: intentId, depositId },
      title: "Deposit",
      subtitle: "QR Ph — Pending payment",
      createdAt: FieldValue.serverTimestamp(),
    });
}

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit({
    scope: "deposits-create",
    key: `${decoded.uid}:${ip}`,
    limit: 10,
    windowSec: 60,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many deposit requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiBadRequest("Invalid JSON body");
  }

  const amount =
    typeof body === "object" && body !== null && "amount" in body
      ? Number((body as { amount: unknown }).amount)
      : NaN;

  const amountError = validateDepositAmount(amount);
  if (amountError) {
    return apiBadRequest(amountError);
  }

  try {
    const centavos = Math.round(amount * 100);
    const { intentId, qrImageUrl, testUrl } =
      await createQrPhPaymentIntent(centavos);

    if (!qrImageUrl) {
      return NextResponse.json(
        { error: "Payment provider did not return a QR code" },
        { status: 502 }
      );
    }

    const depositId = randomUUID();
    const db = getAdminDb();
    let persistOnClient = false;

    if (db) {
      try {
        await persistDepositServerSide(
          db,
          decoded.uid,
          depositId,
          amount,
          intentId,
          qrImageUrl
        );
      } catch (dbErr) {
        console.error("[deposits/create] Firestore persist failed:", dbErr);
        if (isProduction()) {
          throw dbErr;
        }
        persistOnClient = true;
      }
    } else if (!isProduction()) {
      persistOnClient = true;
    } else {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 503 }
      );
    }

    return NextResponse.json({
      qrImageUrl,
      depositId,
      intentId,
      amount,
      persistOnClient,
      testUrl: isPaymongoTestMode() ? testUrl : null,
    });
  } catch (e) {
    return apiError("deposits/create", e, 500, "Failed to create deposit");
  }
}
