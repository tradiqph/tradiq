import { Firestore } from "firebase-admin/firestore";
import { REFERRAL_LEVEL_LABELS, REFERRAL_RATES } from "@/lib/finance";

export const NETWORK_PAGE_SIZE = 20;

export interface NetworkUserRecord {
  id: string;
  displayName: string;
  email: string;
  referredBy: string | null;
}

export interface NetworkMemberRow {
  id: string;
  displayName: string;
  email: string;
  activeBots: number;
}

export interface NetworkLevelSummary {
  level: number;
  label: string;
  count: number;
}

export function parseUserRecords(
  docs: FirebaseFirestore.QueryDocumentSnapshot[]
): NetworkUserRecord[] {
  return docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      displayName: (data.displayName as string) ?? "",
      email: (data.email as string) ?? "",
      referredBy: (data.referredBy as string | null) ?? null,
    };
  });
}

export function buildDownlineLevels(
  rootUserId: string,
  users: NetworkUserRecord[]
): NetworkMemberRow[][] {
  const levels: NetworkMemberRow[][] = Array.from(
    { length: REFERRAL_RATES.length },
    () => []
  );

  let frontier = new Set([rootUserId]);

  for (let levelIndex = 0; levelIndex < REFERRAL_RATES.length; levelIndex++) {
    const nextFrontier = new Set<string>();

    for (const user of users) {
      if (!user.referredBy || !frontier.has(user.referredBy)) continue;
      levels[levelIndex].push({
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        activeBots: 0,
      });
      nextFrontier.add(user.id);
    }

    levels[levelIndex].sort((a, b) =>
      (a.displayName || a.email).localeCompare(b.displayName || b.email)
    );

    frontier = nextFrontier;
    if (frontier.size === 0) break;
  }

  return levels;
}

export function getLevelSummaries(
  levels: NetworkMemberRow[][]
): NetworkLevelSummary[] {
  return REFERRAL_RATES.map((_, index) => ({
    level: index + 1,
    label: REFERRAL_LEVEL_LABELS[index],
    count: levels[index]?.length ?? 0,
  }));
}

export function filterNetworkMembers(
  members: NetworkMemberRow[],
  search: string
): NetworkMemberRow[] {
  const query = search.trim().toLowerCase();
  if (!query) return members;

  return members.filter((member) => {
    const haystack = [member.displayName, member.email].join(" ").toLowerCase();
    return haystack.includes(query);
  });
}

/** Member-facing search — display name only (no email). */
export function filterNetworkMembersByDisplayName(
  members: NetworkMemberRow[],
  search: string
): NetworkMemberRow[] {
  const query = search.trim().toLowerCase();
  if (!query) return members;

  return members.filter((member) =>
    (member.displayName || "Member").toLowerCase().includes(query)
  );
}

export function paginateNetworkMembers<T>(
  members: T[],
  limit: number,
  offset: number
) {
  const total = members.length;
  const page = members.slice(offset, offset + limit);
  return {
    items: page,
    total,
    limit,
    offset,
    hasMore: offset + page.length < total,
  };
}

export async function attachActiveBotCounts(
  db: Firestore,
  members: NetworkMemberRow[]
): Promise<NetworkMemberRow[]> {
  return Promise.all(
    members.map(async (member) => {
      const botsSnap = await db
        .collection("users")
        .doc(member.id)
        .collection("bots")
        .get();

      let activeBots = 0;
      for (const botDoc of botsSnap.docs) {
        if (botDoc.data().status === "active") activeBots += 1;
      }

      return { ...member, activeBots };
    })
  );
}
