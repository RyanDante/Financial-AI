/**
 * Single source of truth for every Firestore path the app writes to.
 * Nothing outside this file should build a collection/document path by hand
 * — that's how a typo ends up reading one user's data into another's view.
 * See docs/FIREBASE.md for the full collection map.
 */

export function userDocPath(uid: string): string {
  return `users/${uid}`;
}

/** Flat per-user subcollections, e.g. users/{uid}/transactions/{id}. */
export function userCollectionPath(uid: string, collectionName: string): string {
  return `users/${uid}/${collectionName}`;
}

export function userDocInCollectionPath(uid: string, collectionName: string, docId: string): string {
  return `${userCollectionPath(uid, collectionName)}/${docId}`;
}

/** Nested: users/{uid}/aiConversations/{conversationId}/messages/{messageId}. */
export function aiConversationMessagesPath(uid: string, conversationId: string): string {
  return `${userCollectionPath(uid, 'aiConversations')}/${conversationId}/messages`;
}

/** Storage paths (Cloud Storage, not Firestore) — kept here since they follow the same uid-scoping rule. */
export function userStoragePath(uid: string, kind: 'receipts' | 'documents' | 'profile', fileId: string): string {
  return `users/${uid}/${kind}/${fileId}`;
}
