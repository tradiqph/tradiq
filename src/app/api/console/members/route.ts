import { NextRequest, NextResponse } from "next/server";
import {
  getMembersSummary,
  mapMemberDoc,
  memberMatchesSearch,
  MEMBERS_PAGE_SIZE,
  sortUserDocsByEmail,
} from "@/lib/console/members";
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
    parseInt(
      request.nextUrl.searchParams.get("limit") ?? String(MEMBERS_PAGE_SIZE),
      10
    ),
    100
  );
  const cursor = request.nextUrl.searchParams.get("cursor");

  const allSnap = await auth.db.collection("users").get();
  const summary = await getMembersSummary(auth.db, search, allSnap.docs);

  let pageDocs: FirebaseFirestore.QueryDocumentSnapshot[];

  if (search) {
    const filtered = sortUserDocsByEmail(
      allSnap.docs.filter((doc) => memberMatchesSearch(doc.data(), search))
    );

    let startIndex = 0;
    if (cursor) {
      const cursorIndex = filtered.findIndex((doc) => doc.id === cursor);
      startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
    }

    const slice = filtered.slice(startIndex, startIndex + limit + 1);
    const hasMore = slice.length > limit;
    pageDocs = slice.slice(0, limit);
    const nextCursor = hasMore ? pageDocs[pageDocs.length - 1]?.id ?? null : null;

    const members = await Promise.all(pageDocs.map((doc) => mapMemberDoc(doc)));

    return NextResponse.json({
      members,
      nextCursor,
      hasMore,
      summary,
      pageSize: limit,
    });
  }

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
  const hasMore = snap.docs.length > limit;
  pageDocs = snap.docs.slice(0, limit);
  const nextCursor = hasMore ? pageDocs[pageDocs.length - 1]?.id ?? null : null;

  const members = await Promise.all(pageDocs.map((doc) => mapMemberDoc(doc)));

  return NextResponse.json({
    members,
    nextCursor,
    hasMore,
    summary,
    pageSize: limit,
  });
}
