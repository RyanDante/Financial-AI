import type { User } from 'firebase/auth';
import type { AuthUser } from './auth.types';

/** Pure — no Firebase call, just a shape conversion. Safe to unit test without a live project. */
export function mapFirebaseUser(user: User | null): AuthUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'That email is already registered. Try signing in instead.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Choose a password with at least 6 characters.',
  'auth/user-not-found': 'No account found for that email.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/network-request-failed': "Couldn't reach the server — check your connection.",
};

/** Converts a Firebase Auth error (or anything else thrown) into a user-facing message. */
export function getAuthErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : null;
  if (code && AUTH_ERROR_MESSAGES[code]) {
    return AUTH_ERROR_MESSAGES[code];
  }
  // Our own config.ts guard throws a specific, already user-actionable message
  // when Firebase env vars are missing — show it verbatim instead of masking
  // it with the generic fallback below.
  if (error instanceof Error && error.message.startsWith('Firebase is not configured')) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
