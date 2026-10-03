export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/** Cloud user profile document at users/{uid} — see docs/FIREBASE.md for the Firestore schema. */
export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  defaultCurrency: string;
  createdAt: string;
  updatedAt: string;
}
