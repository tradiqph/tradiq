import { NextRequest, NextResponse } from "next/server";
import {
  attachActiveBotCounts,
  buildDownlineLevels,
  filterNetworkMembers,
  getLevelSummaries,
  NETWORK_PAGE_SIZE,
  paginateNetworkMembers,
  parseUserRecords,
} from "@/lib/console/member-network";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import { REFERRAL_RATES } from "@/lib/finance";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { userId } = await params;
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

  const rootSnap = await auth.db.collection("users").doc(userId).get();
  if (!rootSnap.exists) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const rootData = rootSnap.data()!;
  const allUsersSnap = await auth.db.collection("users").get();
  const users = parseUserRecords(allUsersSnap.docs);
  const levels = buildDownlineLevels(userId, users);
  const summaries = getLevelSummaries(levels);

  if (!levelParam) {
    return NextResponse.json({
      member: {
        id: userId,
        displayName: rootData.displayName ?? "",
        email: rootData.email ?? "",
      },
      levels: summaries,
    });
  }

  const level = parseInt(levelParam, 10);
  if (!Number.isFinite(level) || level < 1 || level > REFERRAL_RATES.length) {
    return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }

  const levelMembers = levels[level - 1] ?? [];
  const filtered = filterNetworkMembers(levelMembers, search);
  const page = paginateNetworkMembers(filtered, limit, offset);
  const membersWithBots = await attachActiveBotCounts(auth.db, page.items);

  return NextResponse.json({
    members: membersWithBots,
    total: page.total,
    limit: page.limit,
    offset: page.offset,
    hasMore: page.hasMore,
    level,
  });
}
