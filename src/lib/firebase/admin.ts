import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  initializeApp,
  getApps,
  getApp,
  cert,
  App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";

const ADMIN_APP_NAME = "tradiq-admin";

let adminApp: App | null = null;
let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;

function parseServiceAccountJson(raw: string): ServiceAccount | null {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as ServiceAccount;
  } catch {
    const compact = trimmed.replace(/\s*\n\s*/g, "");
    try {
      return JSON.parse(compact) as ServiceAccount;
    } catch {
      return null;
    }
  }
}

function getServiceAccountFromFile(): ServiceAccount | null {
  const candidatePaths = [
    process.env.FIREBASE_ADMIN_CREDENTIALS_PATH,
    join(process.cwd(), "firebase-service-account.json"),
    join(process.cwd(), "service-account.json"),
  ].filter((p): p is string => Boolean(p));

  for (const filePath of candidatePaths) {
    if (!existsSync(filePath)) continue;
    try {
      return JSON.parse(readFileSync(filePath, "utf8")) as ServiceAccount;
    } catch {
      continue;
    }
  }

  return null;
}

function getServiceAccount(): ServiceAccount | null {
  const fromFile = getServiceAccountFromFile();
  if (fromFile) return fromFile;

  const raw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT?.trim();
  if (!raw || raw === "{" || raw.length < 20) return null;

  return parseServiceAccountJson(raw);
}

function resolveProjectId(serviceAccount: ServiceAccount | null): string | null {
  const raw = serviceAccount as ServiceAccount & { project_id?: string };
  const fromAccount = raw?.projectId ?? raw?.project_id;
  if (typeof fromAccount === "string" && fromAccount.length > 0) {
    return fromAccount;
  }
  const fromEnv = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  return fromEnv || null;
}

export function getAdminApp(): App | null {
  if (adminApp) return adminApp;

  const serviceAccount = getServiceAccount();
  const projectId = resolveProjectId(serviceAccount);

  if (!serviceAccount || !projectId) {
    return null;
  }

  try {
    adminApp = initializeApp(
      {
        credential: cert(serviceAccount),
        projectId,
      },
      ADMIN_APP_NAME
    );
    return adminApp;
  } catch {
    try {
      const existing = getApps().find((app) => app.name === ADMIN_APP_NAME);
      adminApp = existing ?? getApp(ADMIN_APP_NAME);
      return adminApp;
    } catch {
      return null;
    }
  }
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
