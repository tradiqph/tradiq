import { NextRequest, NextResponse } from "next/server";
import {
  attachUplineDetails,
  getMembersSummary,
  mapMemberDoc,
  memberMatchesSearch,
  MEMBERS_PAGE_SIZE,
  sortUserDocs,
  type MemberSort,
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
  const sortParam = request.nextUrl.searchParams.get("sort") ?? "newest";
  const sort: MemberSort = sortParam === "newest" ? "newest" : "email";
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

  if (search || sort === "newest") {
    const filtered = search
      ? allSnap.docs.filter((doc) => memberMatchesSearch(doc.data(), search))
      : allSnap.docs;
    const sorted = sortUserDocs(filtered, sort);

    let startIndex = 0;
    if (cursor) {
      const cursorIndex = sorted.findIndex((doc) => doc.id === cursor);
      startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
    }

    const slice = sorted.slice(startIndex, startIndex + limit + 1);
    const hasMore = slice.length > limit;
    pageDocs = slice.slice(0, limit);
    const nextCursor = hasMore ? pageDocs[pageDocs.length - 1]?.id ?? null : null;

    const members = await attachUplineDetails(
      auth.db,
      await Promise.all(pageDocs.map((doc) => mapMemberDoc(doc)))
    );

    return NextResponse.json({
      members,
      nextCursor,
      hasMore,
      summary,
      pageSize: limit,
      sort,
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

  const members = await attachUplineDetails(
    auth.db,
    await Promise.all(pageDocs.map((doc) => mapMemberDoc(doc)))
  );

  return NextResponse.json({
    members,
    nextCursor,
    hasMore,
    summary,
    pageSize: limit,
    sort,
  });
}
