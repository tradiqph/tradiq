"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { generateReferralCode } from "@/lib/finance";
import { createEmptyReferralStats } from "@/lib/referral-stats";
import { UserProfile } from "@/types";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName: string,
    referralCode?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function findUserByReferralCode(code: string): Promise<string | null> {
  if (!db) return null;
  const q = query(
    collection(db, "users"),
    where("referralCode", "==", code.toUpperCase()),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].id;
}

async function ensureUserProfile(
  user: User,
  displayName?: string,
  referralCode?: string
): Promise<UserProfile> {
  if (!db) throw new Error("Firebase not configured");
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return snap.data() as UserProfile;
  }

  let referredBy: string | null = null;
  if (referralCode) {
    referredBy = await findUserByReferralCode(referralCode);
  }

  const name = displayName || user.displayName || user.email?.split("@")[0] || "User";
  const profile: UserProfile = {
    email: user.email ?? "",
    displayName: name,
    photoURL: user.photoURL,
    referralCode: generateReferralCode(name),
    referredBy,
    memberSince: serverTimestamp() as never,
    walletBalance: 0,
    depositBalance: 0,
    totalDeposited: 0,
    totalWithdrawn: 0,
    totalEarnings: 0,
    securityPinHash: null,
    role: "user",
    referralStats: createEmptyReferralStats(),
  };

  await setDoc(ref, profile);
  return profile;
}

async function trackReferralSignupOnServer(user: User) {
  try {
    const token = await user.getIdToken();
    await fetch("/api/referral/on-signup", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Non-blocking — stats update can be retried on next login if needed
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!user || !db) return;
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) setProfile(snap.data() as UserProfile);
  };

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser && db) {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setProfile(data);
          if (data.referredBy && !data.referralNetworkTracked) {
            await trackReferralSignupOnServer(firebaseUser);
            const refreshed = await getDoc(doc(db, "users", firebaseUser.uid));
            if (refreshed.exists()) {
              setProfile(refreshed.data() as UserProfile);
            }
          }
        } else {
          const p = await ensureUserProfile(firebaseUser);
          setProfile(p);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    if (!auth) throw new Error("Firebase is not configured. Check .env.local");
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (db) {
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      }
    }
  };

  const register = async (
    email: string,
    password: string,
    displayName: string,
    referralCode?: string
  ) => {
    if (!auth) throw new Error("Firebase not configured");
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    const p = await ensureUserProfile(cred.user, displayName, referralCode);
    if (p.referredBy) {
      await trackReferralSignupOnServer(cred.user);
      const snap = await getDoc(doc(db!, "users", cred.user.uid));
      if (snap.exists()) setProfile(snap.data() as UserProfile);
    } else {
      setProfile(p);
    }
  };

  const logout = async () => {
    if (!auth) throw new Error("Firebase not configured");
    await signOut(auth);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!auth?.currentUser?.email) {
      throw new Error("You must be signed in with email to change your password");
    }
    if (newPassword.length < 6) {
      throw new Error("New password must be at least 6 characters");
    }

    const credential = EmailAuthProvider.credential(
      auth.currentUser.email,
      currentPassword
    );
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        login,
        register,
        logout,
        refreshProfile,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
