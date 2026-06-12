import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import { assertMemberActionAllowed } from "@/lib/console/member-admin";
import { creditMemberCashDeposit } from "@/lib/console/admin-cash-deposit";
import {
  isCashDepositOperator,
  validateAdminCashDepositAmount,
} from "@/lib/console/cash-deposit";
import { apiBadRequest, apiError } from "@/lib/security/api-errors";

const bodySchema = z.object({
  amount: z.number(),
  note: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isCashDepositOperator(auth.decoded.email)) {
    return NextResponse.json(
      { error: "Cash deposit access is not enabled for this account" },
      { status: 403 }
    );
  }

  const { userId } = await params;
  if (!userId || userId.length > 128) {
    return apiBadRequest("Invalid user id");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiBadRequest("Invalid JSON body");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiBadRequest(parsed.error.issues[0]?.message ?? "Invalid request");
  }

  const amountError = validateAdminCashDepositAmount(parsed.data.amount);
  if (amountError) {
    return apiBadRequest(amountError);
  }

  try {
    await assertMemberActionAllowed(auth.db, auth.decoded.uid, userId);

    const { depositId } = await creditMemberCashDeposit(auth.db, {
      actorUid: auth.decoded.uid,
      actorEmail: auth.decoded.email ?? "",
      userId,
      amount: parsed.data.amount,
      note: parsed.data.note,
    });

    console.info(
      `[console/cash-deposit] ${auth.decoded.email} credited ${parsed.data.amount} to ${userId} (deposit ${depositId})`
    );

    return NextResponse.json({ success: true, depositId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "User not found") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (
      msg.includes("cannot") ||
      msg.includes("Cannot") ||
      msg.includes("own account")
    ) {
      return apiBadRequest(msg);
    }
    return apiError(
      "console/members deposit",
      e,
      500,
      "Failed to credit deposit"
    );
  }
}
