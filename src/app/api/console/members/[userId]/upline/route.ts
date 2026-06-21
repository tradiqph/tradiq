import { NextRequest, NextResponse } from "next/server";
import {
  buildUplineChain,
  parseUserRecords,
} from "@/lib/console/member-network";
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
  const allUsersSnap = await auth.db.collection("users").get();
  const users = parseUserRecords(allUsersSnap.docs);
  const referralCodes = new Map(
    allUsersSnap.docs.map((doc) => [
      doc.id,
      String(doc.data().referralCode ?? ""),
    ])
  );

  const upline = buildUplineChain(userId, users, referralCodes);

  return NextResponse.json({
    member: {
      id: userId,
      displayName: rootData.displayName ?? "",
      email: rootData.email ?? "",
      referralCode: rootData.referralCode ?? "",
      signupReferralCode: rootData.signupReferralCode ?? null,
    },
    upline,
  });
}
