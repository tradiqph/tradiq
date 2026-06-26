import { NextRequest, NextResponse } from "next/server";
import {
  memberMatchesSearch,
  sortUserDocsByEmail,
} from "@/lib/console/members";
import { requireSuperAdmin } from "@/lib/console/require-super-admin";
import {
  checkRateLimit,
  getClientIp,
} from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const ip = getClientIp(request);
  const limitCheck = checkRateLimit({
    scope: "console-members-lookup",
    key: `${auth.decoded.uid}:${ip}`,
    limit: 30,
    windowSec: 60,
  });
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limitCheck.retryAfterSec) } }
    );
  }

  const search = (request.nextUrl.searchParams.get("search") ?? "")
    .trim()
    .toLowerCase();
  const exclude = request.nextUrl.searchParams.get("exclude")?.trim() ?? "";
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get("limit") ?? "8", 10),
    20
  );

  if (search.length < 2) {
    return NextResponse.json({ members: [] });
  }

  const allSnap = await auth.db.collection("users").get();
  const filtered = allSnap.docs.filter((doc) => {
    if (exclude && doc.id === exclude) return false;
    return memberMatchesSearch(doc.data(), search);
  });

  const sorted = sortUserDocsByEmail(filtered).slice(0, limit);

  const members = sorted.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      displayName: String(data.displayName ?? ""),
      email: String(data.email ?? ""),
    };
  });

  return NextResponse.json({ members });
}
