import { NextRequest, NextResponse } from "next/server";
import {
  AUDIT_PAGE_SIZE,
  computeAuditSummary,
  enrichReferralMetadata,
  fetchMemberAuditBots,
  fetchMemberAuditTransactions,
  filterAuditTransactions,
  paginateAuditTransactions,
  parseAuditFilter,
} from "@/lib/console/member-audit";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { userId } = await params;
  const rootSnap = await auth.db.collection("users").doc(userId).get();
  if (!rootSnap.exists) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const rootData = rootSnap.data()!;
  const filter = parseAuditFilter(request.nextUrl.searchParams.get("filter"));
  const limit = Math.min(
    parseInt(
      request.nextUrl.searchParams.get("limit") ?? String(AUDIT_PAGE_SIZE),
      10
    ),
    100
  );
  const cursor = request.nextUrl.searchParams.get("cursor");

  const [allTransactions, bots] = await Promise.all([
    fetchMemberAuditTransactions(auth.db, userId),
    fetchMemberAuditBots(auth.db, userId),
  ]);

  const enrichedTransactions = await enrichReferralMetadata(
    auth.db,
    allTransactions
  );
  const summary = computeAuditSummary(rootData, enrichedTransactions, bots);
  const filtered = filterAuditTransactions(enrichedTransactions, filter);
  const page = paginateAuditTransactions(filtered, limit, cursor);

  return NextResponse.json({
    member: {
      id: userId,
      displayName: rootData.displayName ?? "",
      email: rootData.email ?? "",
      referralCode: rootData.referralCode ?? "",
    },
    summary,
    bots,
    transactions: page.items,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    totalMatching: page.totalMatching,
    filter,
    pageSize: limit,
  });
}
