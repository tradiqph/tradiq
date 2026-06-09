import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  initializeApp,
  getApps,
  cert,
  applicationDefault,
  App,
} from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";

let adminApp: App | null = null;
let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;

function parseServiceAccountJson(raw: string) {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Support .env values where the JSON was split across lines without escaping.
    const compact = trimmed.replace(/\s*\n\s*/g, "");
    try {
      return JSON.parse(compact);
    } catch {
      return null;
    }
  }
}

function getServiceAccountFromFile() {
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

function getServiceAccount() {
  const fromFile = getServiceAccountFromFile();
  if (fromFile) return fromFile;

  const raw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT?.trim();
  if (!raw || raw === "{" || raw.length < 20) return null;

  return parseServiceAccountJson(raw);
}

function initAdminApp(credential: ReturnType<typeof cert>): App | null {
  try {
    return getApps().length ? getApps()[0] : initializeApp({ credential });
  } catch {
    return null;
  }
}

export function getAdminApp(): App | null {
  if (adminApp) return adminApp;

  const serviceAccount = getServiceAccount();
  if (serviceAccount) {
    adminApp = initAdminApp(cert(serviceAccount));
    return adminApp;
  }

  // Only use ADC when no explicit credentials file/env is expected
  if (!process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT?.trim()) {
    try {
      adminApp = initAdminApp(applicationDefault());
      return adminApp;
    } catch {
      return null;
    }
  }

  return null;
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
