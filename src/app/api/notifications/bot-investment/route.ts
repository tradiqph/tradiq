import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuthToken } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { sendBotInvestmentAlert } from "@/lib/email/send";
import { apiBadRequest, apiError } from "@/lib/security/api-errors";

const bodySchema = z.object({
  amount: z.number().positive(),
  botId: z.string().max(128).optional(),
  activeBotCount: z.number().int().min(0).optional(),
});

/** Sends admin email after client-side bot subscribe fallback (local dev). */
export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const db = getAdminDb();
  let memberName = decoded.email ?? "Member";
  let memberEmail = decoded.email ?? "unknown";

  if (db) {
    try {
      const userSnap = await db.collection("users").doc(decoded.uid).get();
      if (userSnap.exists) {
        const data = userSnap.data()!;
        memberName =
          (data.displayName as string | undefined)?.trim() ||
          data.email ||
          memberName;
        memberEmail = (data.email as string) ?? memberEmail;
      }
    } catch {
      // Fall back to token claims
    }
  }

  try {
    const result = await sendBotInvestmentAlert({
      db,
      memberId: decoded.uid,
      memberName,
      memberEmail,
      amount: parsed.data.amount,
      investedAt: new Date(),
      botId: parsed.data.botId,
      activeBotCount: parsed.data.activeBotCount,
    });

    if (!result.ok) {
      console.warn(
        "[notifications/bot-investment] not sent:",
        result.error
      );
      return NextResponse.json(
        { error: result.error ?? "Email not sent" },
        { status: 502 }
      );
    }

    console.info(
      `[notifications/bot-investment] sent uid=${decoded.uid} id=${result.id ?? "unknown"}`
    );
    return NextResponse.json({ success: true, id: result.id });
  } catch (e) {
    return apiError(
      "notifications/bot-investment",
      e,
      500,
      "Failed to send notification"
    );
  }
}
