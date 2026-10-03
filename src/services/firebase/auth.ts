import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeAuth, type Auth } from 'firebase/auth';
// getReactNativePersistence is a real runtime export of the RN build (verified
// in node_modules/@firebase/auth/dist/rn/index.js), but both `firebase/auth`
// and `@firebase/auth`'s exports maps list a platform-agnostic "types"
// condition before their "react-native" branch, so TS's static resolution can
// never reach the RN-specific declarations that include it (firebase-js-sdk
// issue #7615) — not a mistake in our tsconfig. Drop this suppression if a
// future SDK release reorders its exports map and this starts type-checking
// on its own.
// @ts-expect-error — see explanation above
import { getReactNativePersistence } from 'firebase/auth';
import { getFirebaseApp } from './app';

let auth: Auth | null = null;

/**
 * Firebase Auth, persisted via AsyncStorage so the signed-in session
 * survives app restarts (the Firebase JS SDK has no built-in RN persistence
 * — without this it silently falls back to in-memory-only auth state).
 */
export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  auth = initializeAuth(getFirebaseApp(), {
    persistence: getReactNativePersistence(AsyncStorage),
  });
  return auth;
}
