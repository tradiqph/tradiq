"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
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
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { generateReferralCode } from "@/lib/finance";
import { createEmptyReferralStats } from "@/lib/referral-stats";
import { userHasSecurityPin } from "@/lib/security/pin";
import { UserProfile } from "@/types";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  pinSet: boolean;
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
  refreshPinStatus: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function ensureUserProfile(
  user: User,
  displayName?: string
): Promise<UserProfile> {
  if (!db) throw new Error("Firebase not configured");
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return snap.data() as UserProfile;
  }

  const name = displayName || user.displayName || user.email?.split("@")[0] || "User";
  const profile: UserProfile = {
    email: user.email ?? "",
    displayName: name,
    photoURL: user.photoURL,
    referralCode: generateReferralCode(name),
    referredBy: null,
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

  try {
    await setDoc(ref, profile);
  } catch (e) {
    const retry = await getDoc(ref);
    if (retry.exists()) {
      return retry.data() as UserProfile;
    }
    throw e;
  }
  return profile;
}

async function trackReferralSignupOnServer(
  user: User,
  referralCode?: string
): Promise<boolean> {
  try {
    const token = await user.getIdToken();
    const res = await fetch("/api/referral/on-signup", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        referralCode: referralCode?.trim().toUpperCase() || undefined,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchPinStatus(firebaseUser: User): Promise<boolean> {
  try {
    const token = await firebaseUser.getIdToken();
    const res = await fetch("/api/account/pin", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { pinSet?: boolean };
    return Boolean(data.pinSet);
  } catch {
    return false;
  }
}

function needsReferralRetry(data: UserProfile): boolean {
  return (
    !data.referralNetworkTracked ||
    Boolean(data.signupReferralCode && !data.referredBy)
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pinSet, setPinSet] = useState(false);
  const [loading, setLoading] = useState(true);
  const profileCacheRef = useRef<{ uid: string; profile: UserProfile } | null>(
    null
  );

  const applyProfile = (uid: string, data: UserProfile) => {
    profileCacheRef.current = { uid, profile: data };
    setProfile(data);
    setPinSet(userHasSecurityPin(data));
  };

  const runDeferredAuthTasks = (firebaseUser: User, data: UserProfile) => {
    void fetchPinStatus(firebaseUser).then(setPinSet);

    if (!needsReferralRetry(data)) return;

    void trackReferralSignupOnServer(
      firebaseUser,
      data.signupReferralCode
    ).then(async () => {
      if (!db) return;
      const refreshed = await getDoc(doc(db, "users", firebaseUser.uid));
      if (refreshed.exists()) {
        applyProfile(firebaseUser.uid, refreshed.data() as UserProfile);
      }
    });
  };

  const refreshProfile = async () => {
    if (!user || !db) return;
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      applyProfile(user.uid, snap.data() as UserProfile);
    }
  };

  const refreshPinStatus = async () => {
    if (!user) {
      setPinSet(false);
      return;
    }
    setPinSet(await fetchPinStatus(user));
  };

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (!firebaseUser || !db) {
        profileCacheRef.current = null;
        setProfile(null);
        setPinSet(false);
        setLoading(false);
        return;
      }

      const cached = profileCacheRef.current;
      if (cached?.uid === firebaseUser.uid) {
        setProfile(cached.profile);
        setPinSet(userHasSecurityPin(cached.profile));
        setLoading(false);
        runDeferredAuthTasks(firebaseUser, cached.profile);
        return;
      }

      const snap = await getDoc(doc(db, "users", firebaseUser.uid));
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        applyProfile(firebaseUser.uid, data);
        setLoading(false);
        runDeferredAuthTasks(firebaseUser, data);
        return;
      }

      const created = await ensureUserProfile(firebaseUser);
      applyProfile(firebaseUser.uid, created);
      setLoading(false);
      runDeferredAuthTasks(firebaseUser, created);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    if (!auth) throw new Error("Firebase is not configured. Check .env.local");
    const cred = await signInWithEmailAndPassword(auth, email, password);
    setUser(cred.user);

    if (db) {
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        applyProfile(cred.user.uid, data);
      }
    }

    setLoading(false);
    if (profileCacheRef.current?.uid === cred.user.uid) {
      runDeferredAuthTasks(cred.user, profileCacheRef.current.profile);
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
    setUser(cred.user);
    await updateProfile(cred.user, { displayName });
    const p = await ensureUserProfile(cred.user, displayName);
    applyProfile(cred.user.uid, p);
    setLoading(false);

    const referralOk = await trackReferralSignupOnServer(cred.user, referralCode);
    if (referralOk && db) {
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (snap.exists()) {
        applyProfile(cred.user.uid, snap.data() as UserProfile);
      }
    } else {
      runDeferredAuthTasks(cred.user, p);
    }
  };

  const logout = async () => {
    if (!auth) throw new Error("Firebase not configured");
    profileCacheRef.current = null;
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
        pinSet,
        loading,
        login,
        register,
        logout,
        refreshProfile,
        refreshPinStatus,
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
