import { Firestore, Query } from "firebase-admin/firestore";
import { getAdminAuth } from "@/lib/firebase/admin";
import { isSuperAdminRole } from "@/lib/roles";

async function deleteQueryBatch(
  db: Firestore,
  query: Query,
  batchSize = 400
) {
  const snap = await query.limit(batchSize).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  if (snap.size >= batchSize) {
    await deleteQueryBatch(db, query, batchSize);
  }
}

async function deleteSubcollection(
  db: Firestore,
  parentRef: FirebaseFirestore.DocumentReference,
  subName: string
) {
  await deleteQueryBatch(db, parentRef.collection(subName));
}

export async function deleteUserCompletely(db: Firestore, userId: string) {
  const userRef = db.collection("users").doc(userId);

  await deleteSubcollection(db, userRef, "transactions");
  await deleteSubcollection(db, userRef, "bots");
  await deleteSubcollection(db, userRef, "withdrawalAccounts");

  const ticketsSnap = await db
    .collection("supportTickets")
    .where("userId", "==", userId)
    .get();
  for (const ticket of ticketsSnap.docs) {
    await deleteSubcollection(db, ticket.ref, "replies");
    await ticket.ref.delete();
  }

  await deleteQueryBatch(
    db,
    db.collection("deposits").where("userId", "==", userId)
  );
  await deleteQueryBatch(
    db,
    db.collection("withdrawalRequests").where("userId", "==", userId)
  );

  await userRef.delete();

  const auth = getAdminAuth();
  if (auth) {
    try {
      await auth.deleteUser(userId);
    } catch {
      // Firestore profile removed; auth user may already be gone
    }
  }
}

export async function assertMemberActionAllowed(
  db: Firestore,
  actorUid: string,
  targetUid: string
) {
  if (actorUid === targetUid) {
    throw new Error("You cannot perform this action on your own account");
  }

  const targetSnap = await db.collection("users").doc(targetUid).get();
  if (!targetSnap.exists) {
    throw new Error("User not found");
  }

  if (isSuperAdminRole(targetSnap.data()?.role)) {
    throw new Error("Cannot modify or delete a super admin account");
  }

  return targetSnap;
}
