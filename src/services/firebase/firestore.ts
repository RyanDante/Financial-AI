import { initializeFirestore, type Firestore } from 'firebase/firestore';
import { getFirebaseApp } from './app';

let firestore: Firestore | null = null;

/**
 * Firestore's default streaming transport (WebChannel) can fail silently in
 * React Native's networking layer, which doesn't support the same
 * streaming semantics as a browser. Auto-detecting long-polling avoids
 * that — the SDK falls back to long-polling only if it detects streaming
 * isn't working, so this is a no-op in environments where streaming is
 * fine.
 */
export function getFirebaseFirestore(): Firestore {
  if (firestore) return firestore;
  firestore = initializeFirestore(getFirebaseApp(), {
    experimentalAutoDetectLongPolling: true,
  });
  return firestore;
}
