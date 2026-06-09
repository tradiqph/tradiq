import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { claimDepositPayment } from "@/lib/deposits-server";

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authHeader = request.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "";

  const { intentId, depositId } = await request.json();
  if (!intentId || typeof intentId !== "string") {
    return NextResponse.json({ error: "Missing intentId" }, { status: 400 });
  }

  try {
    const result = await claimDepositPayment(
      intentId,
      typeof depositId === "string" ? depositId : undefined,
      idToken
    );

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Claim failed" },
      { status: 500 }
    );
  }
}
