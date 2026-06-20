import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { reconcileReferralMemberCounts } from "@/lib/admin-calculations";
import {
  attachActiveBotCounts,
  buildDownlineLevels,
  filterNetworkMembersByDisplayName,
  getLevelSummaries,
  NETWORK_PAGE_SIZE,
  paginateNetworkMembers,
  parseUserRecords,
} from "@/lib/console/member-network";
import { REFERRAL_RATES } from "@/lib/finance";
import { getAdminDb } from "@/lib/firebase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitCheck = checkRateLimit({
    scope: "referral-network",
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

  const rootUserId = decoded.uid;
  const levelParam = request.nextUrl.searchParams.get("level");
  const search = (request.nextUrl.searchParams.get("search") ?? "").trim();
  const limit = Math.min(
    parseInt(
      request.nextUrl.searchParams.get("limit") ?? String(NETWORK_PAGE_SIZE),
      10
    ),
    100
  );
  const offset = Math.max(
    parseInt(request.nextUrl.searchParams.get("offset") ?? "0", 10),
    0
  );

  const allUsersSnap = await db.collection("users").get();
  const users = parseUserRecords(allUsersSnap.docs);
  const levels = buildDownlineLevels(rootUserId, users);
  const summaries = getLevelSummaries(levels);

  if (!levelParam) {
    await reconcileReferralMemberCounts(db, rootUserId, users);
    return NextResponse.json({ levels: summaries });
  }

  const level = parseInt(levelParam, 10);
  if (!Number.isFinite(level) || level < 1 || level > REFERRAL_RATES.length) {
    return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }

  const levelMembers = levels[level - 1] ?? [];
  const filtered = filterNetworkMembersByDisplayName(levelMembers, search);
  const page = paginateNetworkMembers(filtered, limit, offset);
  const membersWithBots = await attachActiveBotCounts(db, page.items);

  return NextResponse.json({
    members: membersWithBots.map(
      ({ id, displayName, activeBots, activeBotPrincipal }) => ({
        id,
        displayName: displayName.trim() || "Member",
        activeBots,
        activeBotPrincipal,
      })
    ),
    total: page.total,
    limit: page.limit,
    offset: page.offset,
    hasMore: page.hasMore,
    level,
  });
}
