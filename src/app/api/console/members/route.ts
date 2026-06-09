import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const search = (request.nextUrl.searchParams.get("search") ?? "")
    .trim()
    .toLowerCase();
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10),
    100
  );
  const cursor = request.nextUrl.searchParams.get("cursor");

  let query = auth.db.collection("users").orderBy("email").limit(limit + 1);
  if (cursor) {
    const cursorDoc = await auth.db.collection("users").doc(cursor).get();
    if (cursorDoc.exists) {
      query = auth.db
        .collection("users")
        .orderBy("email")
        .startAfter(cursorDoc)
        .limit(limit + 1);
    }
  }

  const snap = await query.get();
  let docs = snap.docs;

  if (search) {
    const allSnap = await auth.db.collection("users").get();
    docs = allSnap.docs
      .filter((d) => {
        const data = d.data();
        const haystack = [
          data.displayName,
          data.email,
          data.referralCode,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      })
      .slice(0, limit + 1);
  }

  const pageDocs = docs.slice(0, limit);
  const hasMore = docs.length > limit;
  const nextCursor = hasMore ? pageDocs[pageDocs.length - 1]?.id : null;

  const members = await Promise.all(
    pageDocs.map(async (doc) => {
      const d = doc.data();
      const botsSnap = await doc.ref.collection("bots").get();
      const activeBots = botsSnap.docs.filter(
        (b) => b.data().status === "active"
      ).length;

      return {
        id: doc.id,
        displayName: d.displayName ?? "",
        email: d.email ?? "",
        referralCode: d.referralCode ?? "",
        role: d.role ?? "user",
        walletBalance: d.walletBalance ?? 0,
        depositBalance: d.depositBalance ?? 0,
        totalDeposited: d.totalDeposited ?? 0,
        totalWithdrawn: d.totalWithdrawn ?? 0,
        activeBots,
        memberSince: d.memberSince?.toDate?.()?.toISOString() ?? null,
      };
    })
  );

  return NextResponse.json({ members, nextCursor, hasMore });
}
