import { NextRequest } from "next/server";
import { Firestore } from "firebase-admin/firestore";
import { verifyAuthToken } from "@/lib/api-auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { isSuperAdminRole } from "@/lib/roles";

export type SuperAdminAuth =
  | { ok: true; decoded: { uid: string; email?: string }; db: Firestore }
  | { ok: false; status: number; error: string };

async function getRoleFromFirestoreRest(
  uid: string,
  idToken: string
): Promise<string | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;

  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`,
      {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.fields?.role?.stringValue ?? null;
  } catch {
    return null;
  }
}

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export async function requireSuperAdmin(
  request: NextRequest
): Promise<SuperAdminAuth> {
  const token = getBearerToken(request);
  if (!token) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const decoded = await verifyAuthToken(request);
  if (!decoded) {
    return { ok: false, status: 401, error: "Invalid or expired session" };
  }

  const db = getAdminDb();
  if (!db) {
    const role = await getRoleFromFirestoreRest(decoded.uid, token);
    if (!isSuperAdminRole(role)) {
      return {
        ok: false,
        status: 403,
        error:
          'Super admin access required. Set role: "super_admin" on your user document in Firestore.',
      };
    }
    return {
      ok: false,
      status: 503,
      error:
        "Firebase Admin is not configured. Add FIREBASE_ADMIN_SERVICE_ACCOUNT to .env.local (Firebase Console → Project Settings → Service accounts → Generate new private key), then restart the dev server.",
    };
  }

  const userSnap = await db.collection("users").doc(decoded.uid).get();
  if (!userSnap.exists) {
    return { ok: false, status: 403, error: "User profile not found" };
  }

  if (!isSuperAdminRole(userSnap.data()?.role)) {
    return {
      ok: false,
      status: 403,
      error:
        'Super admin access required. Your role must be "super_admin" in Firestore (not "admin").',
    };
  }

  return { ok: true, decoded, db };
}
