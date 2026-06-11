import { Firestore } from "firebase-admin/firestore";
import { fetchAllUserBots } from "@/lib/console/fetch-bots";

export const MEMBERS_PAGE_SIZE = 20;

export interface MemberActiveBot {
  id: string;
  amount: number;
  subscribedAt: string | null;
}

function toBotDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof (value as { seconds: number }).seconds === "number") {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  return null;
}

export async function fetchMemberActiveBots(
  db: Firestore,
  userId: string
): Promise<MemberActiveBot[]> {
  const botsSnap = await db
    .collection("users")
    .doc(userId)
    .collection("bots")
    .get();

  const bots: MemberActiveBot[] = [];
  for (const botDoc of botsSnap.docs) {
    const bot = botDoc.data();
    if (bot.status !== "active") continue;
    bots.push({
      id: botDoc.id,
      amount: bot.amount ?? 0,
      subscribedAt: toBotDate(bot.subscribedAt)?.toISOString() ?? null,
    });
  }

  bots.sort((a, b) => (b.subscribedAt ?? "").localeCompare(a.subscribedAt ?? ""));
  return bots;
}

export function memberMatchesSearch(
  data: FirebaseFirestore.DocumentData,
  search: string
): boolean {
  if (!search) return true;
  const haystack = [data.displayName, data.email, data.referralCode]
    .join(" ")
    .toLowerCase();
  return haystack.includes(search);
}

export function sortUserDocsByEmail(
  docs: FirebaseFirestore.QueryDocumentSnapshot[]
) {
  return [...docs].sort((a, b) =>
    String(a.data().email ?? "").localeCompare(String(b.data().email ?? ""))
  );
}

export async function getMembersSummary(
  db: Firestore,
  search: string,
  userDocs: FirebaseFirestore.QueryDocumentSnapshot[]
) {
  const filtered = search
    ? userDocs.filter((doc) => memberMatchesSearch(doc.data(), search))
    : userDocs;

  const filteredIds = new Set(filtered.map((doc) => doc.id));
  const activeBots = await fetchAllUserBots(db, "active");
  const investedUserIds = new Set(activeBots.map((bot) => bot.userId));

  const totalInvestedMembers = [...investedUserIds].filter((userId) =>
    filteredIds.has(userId)
  ).length;

  return {
    totalMembers: filtered.length,
    totalInvestedMembers,
  };
}

export async function mapMemberDoc(
  doc: FirebaseFirestore.QueryDocumentSnapshot
) {
  const d = doc.data();
  const botsSnap = await doc.ref.collection("bots").get();
  let activeBots = 0;
  let activeBotPrincipal = 0;

  for (const botDoc of botsSnap.docs) {
    const bot = botDoc.data();
    if (bot.status !== "active") continue;
    activeBots += 1;
    activeBotPrincipal += bot.amount ?? 0;
  }

  return {
    id: doc.id,
    displayName: d.displayName ?? "",
    email: d.email ?? "",
    referralCode: d.referralCode ?? "",
    role: d.role ?? "user",
    walletBalance: d.walletBalance ?? 0,
    depositBalance: d.depositBalance ?? 0,
    totalDeposited: d.totalDeposited ?? 0,
    totalWithdrawn: d.totalWithdrawn ?? 0,
    activeBots,
    activeBotPrincipal: Math.round(activeBotPrincipal * 100) / 100,
    memberSince: d.memberSince?.toDate?.()?.toISOString() ?? null,
  };
}
