import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertMemberActionAllowed } from "@/lib/console/member-admin";
import {
  disableQaEligibility,
  enableQaEligibility,
  getQaEligibilityStatus,
  markQaTestAccount,
  resetQaTestState,
} from "@/lib/console/qa-eligibility";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import { apiBadRequest } from "@/lib/security/api-errors";

const patchSchema = z.object({
  action: z.enum(["markTestAccount", "enable", "disable", "reset"]),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { userId } = await params;

  try {
    await assertMemberActionAllowed(auth.db, auth.decoded.uid, userId);
    const status = await getQaEligibilityStatus(auth.db, userId);
    return NextResponse.json(status);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load QA status";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { userId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiBadRequest("Invalid JSON body");
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiBadRequest(parsed.error.issues[0]?.message ?? "Invalid request");
  }

  try {
    await assertMemberActionAllowed(auth.db, auth.decoded.uid, userId);

    let status;
    switch (parsed.data.action) {
      case "markTestAccount":
        status = await markQaTestAccount(
          auth.db,
          userId,
          auth.decoded.uid
        );
        break;
      case "enable":
        status = await enableQaEligibility(
          auth.db,
          userId,
          auth.decoded.uid
        );
        break;
      case "disable":
        status = await disableQaEligibility(
          auth.db,
          userId,
          auth.decoded.uid
        );
        break;
      case "reset":
        status = await resetQaTestState(auth.db, userId, auth.decoded.uid);
        break;
    }

    return NextResponse.json(status);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update QA eligibility";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
