import type { User } from 'firebase/auth';
import type { AuthUser } from './auth.types';
import { t, type MessageKey } from '@/i18n';

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

const AUTH_ERROR_MESSAGES: Record<string, MessageKey> = {
  'auth/email-already-in-use': 'auth.err.emailInUse',
  'auth/invalid-email': 'auth.err.invalidEmail',
  'auth/weak-password': 'auth.err.weakPassword',
  'auth/user-not-found': 'auth.err.userNotFound',
  'auth/wrong-password': 'auth.err.wrongPassword',
  'auth/invalid-credential': 'auth.err.invalidCredential',
  'auth/too-many-requests': 'auth.err.tooMany',
  'auth/network-request-failed': 'auth.err.network',
};

/** Converts a Firebase Auth error (or anything else thrown) into a user-facing message. */
export function getAuthErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : null;
  if (code && AUTH_ERROR_MESSAGES[code]) {
    return t(AUTH_ERROR_MESSAGES[code]);
  }
  // Our own config.ts guard throws a specific, already user-actionable message
  // when Firebase env vars are missing — show it verbatim instead of masking
  // it with the generic fallback below.
  if (error instanceof Error && error.message.startsWith('Firebase is not configured')) {
    return error.message;
  }
  return t('auth.err.generic');
}
