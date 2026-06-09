import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { claimDepositPayment } from "@/lib/deposits-server";
import { apiBadRequest, apiError } from "@/lib/security/api-errors";
import { intentIdSchema } from "@/lib/security/validation";

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authHeader = request.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "";

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiBadRequest("Invalid JSON body");
  }

  const intentId =
    typeof body === "object" && body !== null && "intentId" in body
      ? body.intentId
      : undefined;
  const depositId =
    typeof body === "object" && body !== null && "depositId" in body
      ? body.depositId
      : undefined;

  const parsedIntent = intentIdSchema.safeParse(intentId);
  if (!parsedIntent.success) {
    return apiBadRequest("Missing or invalid intentId");
  }

  try {
    const result = await claimDepositPayment(
      parsedIntent.data,
      typeof depositId === "string" ? depositId : undefined,
      idToken,
      decoded.uid
    );

    return NextResponse.json(result);
  } catch (e) {
    return apiError("deposits/claim", e, 500, "Failed to claim deposit");
  }
}
