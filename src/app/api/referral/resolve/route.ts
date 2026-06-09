import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ referrerUid: null, valid: false });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 503 }
    );
  }

  const snap = await db
    .collection("users")
    .where("referralCode", "==", code)
    .limit(1)
    .get();

  if (snap.empty) {
    return NextResponse.json({ referrerUid: null, valid: false });
  }

  return NextResponse.json({
    referrerUid: snap.docs[0].id,
    valid: true,
  });
}
