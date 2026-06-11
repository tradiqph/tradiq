import { NextRequest, NextResponse } from "next/server";
import { fetchMemberActiveBots } from "@/lib/console/members";
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
  const bots = await fetchMemberActiveBots(auth.db, userId);

  return NextResponse.json({
    member: {
      id: userId,
      displayName: rootData.displayName ?? "",
      email: rootData.email ?? "",
    },
    bots,
  });
}
