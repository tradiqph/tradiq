import { NextRequest } from "next/server";
import { verifyAuthToken } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { isSuperAdminRole } from "@/lib/roles";

export async function requireSuperAdmin(request: NextRequest) {
  const decoded = await verifyAuthToken(request);
  if (!decoded) return null;

  const db = getAdminDb();
  if (!db) return null;

  const userSnap = await db.collection("users").doc(decoded.uid).get();
  if (!userSnap.exists || !isSuperAdminRole(userSnap.data()?.role)) return null;

  return { decoded, db };
}
