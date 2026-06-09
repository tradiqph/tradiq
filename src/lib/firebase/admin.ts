import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";

let adminApp: App | null = null;
let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;

function getServiceAccount() {
  const raw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  const candidatePaths = [
    process.env.FIREBASE_ADMIN_CREDENTIALS_PATH,
    join(process.cwd(), "firebase-service-account.json"),
    join(process.cwd(), "service-account.json"),
  ].filter((p): p is string => Boolean(p));

  for (const filePath of candidatePaths) {
    if (!existsSync(filePath)) continue;
    try {
      return JSON.parse(readFileSync(filePath, "utf8"));
    } catch {
      continue;
    }
  }

  return null;
}

export function getAdminApp(): App | null {
  if (adminApp) return adminApp;
  const serviceAccount = getServiceAccount();
  if (!serviceAccount) return null;

  adminApp = getApps().length
    ? getApps()[0]
    : initializeApp({ credential: cert(serviceAccount) });
  return adminApp;
}

export function getAdminDb(): Firestore | null {
  if (adminDb) return adminDb;
  const app = getAdminApp();
  if (!app) return null;
  adminDb = getFirestore(app);
  return adminDb;
}

export function getAdminAuth(): Auth | null {
  if (adminAuth) return adminAuth;
  const app = getAdminApp();
  if (!app) return null;
  adminAuth = getAuth(app);
  return adminAuth;
}
