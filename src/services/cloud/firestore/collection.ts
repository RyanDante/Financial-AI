import { collection, doc, getDocs, query, setDoc, where, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
// Specific submodule, not the @/services/firebase barrel — see the same note in services/cloud/storage.ts.
import { getFirebaseFirestore } from '@/services/firebase/firestore';
import { isoToTimestamp } from '@/services/sync/sync.mapper';
import { userCollectionPath, userDocInCollectionPath } from './paths';
import type { SyncEntityConfig } from '@/services/sync/sync.types';

/**
 * Generic Firestore access for any flat users/{uid}/{collection} entity.
 * The sync service is the only caller — screens and the AI tools never
 * import this directly, so Firestore access always goes through the sync
 * engine's conflict/timestamp handling.
 */

/** Writes one document, using the LOCAL record id as the Firestore doc id (stable-id sync, never a server-generated id). */
export async function pushDoc(uid: string, entity: SyncEntityConfig, id: string, data: Record<string, unknown>): Promise<void> {
  const ref = doc(getFirebaseFirestore(), userDocInCollectionPath(uid, entity.collectionName, id));
  await setDoc(ref, data, { merge: true });
}

function docToPlainObject(snapshot: QueryDocumentSnapshot<DocumentData>): Record<string, unknown> {
  return { id: snapshot.id, ...snapshot.data() };
}

/**
 * Reads every document changed after `sinceIso` (or every document, if
 * null — the first pull for a fresh install). Ordered by the same
 * timestamp field so the caller can advance its watermark safely even if
 * it stops partway through a large result set.
 */
export async function pullChangedDocs(uid: string, entity: SyncEntityConfig, sinceIso: string | null): Promise<Record<string, unknown>[]> {
  const db = getFirebaseFirestore();
  const collectionRef = collection(db, userCollectionPath(uid, entity.collectionName));
  const timestampField = entity.timestampColumn === 'created_at' ? 'createdAt' : 'updatedAt';

  const snapshot = sinceIso
    ? await getDocs(query(collectionRef, where(timestampField, '>', isoToTimestamp(sinceIso))))
    : await getDocs(collectionRef);

  return snapshot.docs.map(docToPlainObject);
}
