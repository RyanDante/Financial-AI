import { doc, getDoc, setDoc } from 'firebase/firestore';
// Specific submodule, not the @/services/firebase barrel — see the note in services/cloud/storage.ts.
import { getFirebaseFirestore } from '@/services/firebase/firestore';
import { userDocPath } from '@/services/cloud/firestore/paths';
import { DEFAULT_CURRENCY } from '@/constants/currencies';
import type { AuthUser, UserProfile } from './auth.types';

function docRef(uid: string) {
  return doc(getFirebaseFirestore(), userDocPath(uid));
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(docRef(uid));
  return snapshot.exists() ? (snapshot.data() as UserProfile) : null;
}

/** Creates the users/{uid} profile doc if it doesn't exist yet (first sign-in). Idempotent. */
export async function ensureUserProfile(user: AuthUser): Promise<UserProfile> {
  const existing = await getUserProfile(user.uid);
  if (existing) return existing;

  const now = new Date().toISOString();
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    defaultCurrency: DEFAULT_CURRENCY,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(docRef(user.uid), profile);
  return profile;
}

export async function updateUserProfile(uid: string, patch: Partial<Omit<UserProfile, 'uid' | 'createdAt'>>): Promise<void> {
  await setDoc(docRef(uid), { ...patch, updatedAt: new Date().toISOString() }, { merge: true });
}
