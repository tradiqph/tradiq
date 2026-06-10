import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { FieldValue } from "firebase-admin/firestore";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import {
  assertMemberActionAllowed,
  deleteUserCompletely,
} from "@/lib/console/member-admin";
import { getAdminAuth } from "@/lib/firebase/admin";
import { apiBadRequest, apiError } from "@/lib/security/api-errors";
import { pinSchema } from "@/lib/security/validation";
import { z } from "zod";

const setPasswordSchema = z.object({
  action: z.literal("setPassword"),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
});

const setPinSchema = z.object({
  action: z.literal("setPin"),
  pin: pinSchema,
});

const clearPinSchema = z.object({
  action: z.literal("clearPin"),
});

const patchSchema = z.discriminatedUnion("action", [
  setPasswordSchema,
  setPinSchema,
  clearPinSchema,
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiBadRequest(parsed.error.issues[0]?.message ?? "Invalid request");
  }

  try {
    await assertMemberActionAllowed(auth.db, auth.decoded.uid, userId);

    if (parsed.data.action === "setPassword") {
      const adminAuth = getAdminAuth();
      if (!adminAuth) {
        return NextResponse.json(
          { error: "Server not configured" },
          { status: 503 }
        );
      }
      await adminAuth.updateUser(userId, {
        password: parsed.data.password,
      });
      console.info(
        `[console/members] password reset by ${auth.decoded.uid} for ${userId}`
      );
      return NextResponse.json({ success: true });
    }

    if (parsed.data.action === "setPin") {
      const hash = await bcrypt.hash(parsed.data.pin, 12);
      await auth.db.collection("users").doc(userId).update({
        securityPinHash: hash,
      });
      console.info(
        `[console/members] PIN set by ${auth.decoded.uid} for ${userId}`
      );
      return NextResponse.json({ success: true });
    }

    if (parsed.data.action === "clearPin") {
      await auth.db.collection("users").doc(userId).update({
        securityPinHash: FieldValue.delete(),
      });
      console.info(
        `[console/members] PIN cleared by ${auth.decoded.uid} for ${userId}`
      );
      return NextResponse.json({ success: true });
    }

    return apiBadRequest("Unknown action");
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
    return apiError("console/members PATCH", e, 500, "Failed to update member");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { userId } = await params;
  if (!userId || userId.length > 128) {
    return apiBadRequest("Invalid user id");
  }

  try {
    const target = await assertMemberActionAllowed(
      auth.db,
      auth.decoded.uid,
      userId
    );
    const email = target.data()?.email ?? userId;

    await deleteUserCompletely(auth.db, userId);
    console.info(
      `[console/members] deleted ${email} (${userId}) by ${auth.decoded.uid}`
    );

    return NextResponse.json({ success: true });
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
    return apiError("console/members DELETE", e, 500, "Failed to delete member");
  }
}
