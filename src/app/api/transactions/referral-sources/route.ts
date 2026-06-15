import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuthToken } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  buildDownlineLevels,
  parseUserRecords,
} from "@/lib/console/member-network";
import { checkRateLimit } from "@/lib/security/rate-limit";

const bodySchema = z.object({
  userIds: z.array(z.string().min(1)).max(50),
});

function memberLabel(displayName: string, email: string): string {
  if (displayName.trim()) return displayName.trim();
  if (email.trim()) return email.trim();
  return "Member";
}

export async function POST(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitCheck = checkRateLimit({
    scope: "transaction-referral-sources",
    key: decoded.uid,
    limit: 30,
    windowSec: 60,
  });

  if (!limitCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(limitCheck.retryAfterSec) },
      }
    );
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const allUsersSnap = await db.collection("users").get();
  const users = parseUserRecords(allUsersSnap.docs);
  const levels = buildDownlineLevels(decoded.uid, users);
  const downlineById = new Map(
    levels.flat().map((member) => [member.id, member])
  );

  const labels: Record<string, string> = {};
  for (const userId of parsed.data.userIds) {
    const member = downlineById.get(userId);
    if (!member) continue;
    labels[userId] = memberLabel(member.displayName, member.email);
  }

  return NextResponse.json({ labels });
}
