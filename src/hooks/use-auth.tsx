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
  displayName?: string,
  referralCode?: string,
  source = "unknown"
): Promise<UserProfile> {
  if (!db) throw new Error("Firebase not configured");
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  // #region agent log
  fetch("http://127.0.0.1:7895/ingest/7d838b4c-6b8d-4032-bbe8-76fd27a95288", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "172a42",
    },
    body: JSON.stringify({
      sessionId: "172a42",
      hypothesisId: "A",
      location: "use-auth.tsx:ensureUserProfile:getDoc",
      message: "ensureUserProfile getDoc result",
      data: { source, exists: snap.exists(), uid: user.uid },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

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
    // #region agent log
    fetch("http://127.0.0.1:7895/ingest/7d838b4c-6b8d-4032-bbe8-76fd27a95288", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "172a42",
      },
      body: JSON.stringify({
        sessionId: "172a42",
        hypothesisId: "A",
        location: "use-auth.tsx:ensureUserProfile:setDoc:ok",
        message: "setDoc succeeded",
        data: { source, uid: user.uid },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  } catch (e) {
    const retry = await getDoc(ref);
    const errCode =
      e && typeof e === "object" && "code" in e
        ? String((e as { code: string }).code)
        : "unknown";
    // #region agent log
    fetch("http://127.0.0.1:7895/ingest/7d838b4c-6b8d-4032-bbe8-76fd27a95288", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "172a42",
      },
      body: JSON.stringify({
        sessionId: "172a42",
        hypothesisId: "A",
        location: "use-auth.tsx:ensureUserProfile:setDoc:error",
        message: "setDoc failed",
        data: {
          source,
          uid: user.uid,
          errCode,
          retryExists: retry.exists(),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pinSet, setPinSet] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!user || !db) return;
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      setProfile(data);
      setPinSet(userHasSecurityPin(data));
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
      if (firebaseUser && db) {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setProfile(data);
          setPinSet(userHasSecurityPin(data));
          void fetchPinStatus(firebaseUser).then(setPinSet);
          if (
            !data.referralNetworkTracked ||
            (data.signupReferralCode && !data.referredBy)
          ) {
            await trackReferralSignupOnServer(
              firebaseUser,
              data.signupReferralCode
            );
            const refreshed = await getDoc(doc(db, "users", firebaseUser.uid));
            if (refreshed.exists()) {
              setProfile(refreshed.data() as UserProfile);
            }
          }
        } else {
          const p = await ensureUserProfile(firebaseUser, undefined, undefined, "onAuthStateChanged");
          setProfile(p);
        }
      } else {
        setProfile(null);
        setPinSet(false);
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
        const data = snap.data() as UserProfile;
        setProfile(data);
        setPinSet(userHasSecurityPin(data));
      }
      void fetchPinStatus(cred.user).then(setPinSet);
    }
  };

  const register = async (
    email: string,
    password: string,
    displayName: string,
    referralCode?: string
  ) => {
    if (!auth) throw new Error("Firebase not configured");
    // #region agent log
    fetch("http://127.0.0.1:7895/ingest/7d838b4c-6b8d-4032-bbe8-76fd27a95288", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "172a42",
      },
      body: JSON.stringify({
        sessionId: "172a42",
        hypothesisId: "E",
        location: "use-auth.tsx:register:start",
        message: "register started",
        data: { hasReferral: Boolean(referralCode) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // #region agent log
    fetch("http://127.0.0.1:7895/ingest/7d838b4c-6b8d-4032-bbe8-76fd27a95288", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "172a42",
      },
      body: JSON.stringify({
        sessionId: "172a42",
        hypothesisId: "E",
        location: "use-auth.tsx:register:authCreated",
        message: "auth user created",
        data: { uid: cred.user.uid },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    await updateProfile(cred.user, { displayName });
    const p = await ensureUserProfile(
      cred.user,
      displayName,
      referralCode,
      "register"
    );
    const referralOk = await trackReferralSignupOnServer(cred.user, referralCode);
    // #region agent log
    fetch("http://127.0.0.1:7895/ingest/7d838b4c-6b8d-4032-bbe8-76fd27a95288", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "172a42",
      },
      body: JSON.stringify({
        sessionId: "172a42",
        hypothesisId: "D",
        location: "use-auth.tsx:register:referral",
        message: "referral signup API finished",
        data: { referralOk },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    const snap = await getDoc(doc(db!, "users", cred.user.uid));
    if (snap.exists()) setProfile(snap.data() as UserProfile);
    else setProfile(p);
    // #region agent log
    fetch("http://127.0.0.1:7895/ingest/7d838b4c-6b8d-4032-bbe8-76fd27a95288", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "172a42",
      },
      body: JSON.stringify({
        sessionId: "172a42",
        hypothesisId: "E",
        location: "use-auth.tsx:register:done",
        message: "register completed",
        data: { profileExists: snap.exists() },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
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
