import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assignMemberUpline } from "@/lib/console/assign-upline";
import { assertMemberActionAllowed } from "@/lib/console/member-admin";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import { apiBadRequest, apiError } from "@/lib/security/api-errors";
import {
  checkRateLimit,
  getClientIp,
} from "@/lib/security/rate-limit";

const bodySchema = z.object({
  uplineEmail: z.string().email("Enter a valid upline email"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit({
    scope: "console-assign-upline",
    key: `${auth.decoded.uid}:${ip}`,
    limit: 10,
    windowSec: 60,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
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

  const memberSnap = await auth.db.collection("users").doc(userId).get();
  if (!memberSnap.exists) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const referredBy = (memberSnap.data()?.referredBy as string | null) ?? null;
  if (referredBy !== null) {
    return apiBadRequest("Member already has an upline");
  }

  try {
    await assertMemberActionAllowed(auth.db, auth.decoded.uid, userId);

    const result = await assignMemberUpline(auth.db, {
      memberUid: userId,
      uplineEmail: parsed.data.uplineEmail,
    });

    console.info(
      `[console/assign-upline] ${auth.decoded.email} linked ${userId} -> ${result.upline.id} (bots commissioned: ${result.botsCommissioned})`
    );

    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (
      msg.includes("not found") ||
      msg.includes("cannot") ||
      msg.includes("Cannot") ||
      msg.includes("cycle") ||
      msg.includes("same user") ||
      msg.includes("already linked") ||
      msg.includes("Multiple users")
    ) {
      return apiBadRequest(msg);
    }
    return apiError(
      "console/members assign-upline",
      e,
      500,
      "Failed to assign upline"
    );
  }
}
