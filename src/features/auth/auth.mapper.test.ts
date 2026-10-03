import { getAuthErrorMessage, mapFirebaseUser } from './auth.mapper';
import type { User } from 'firebase/auth';

describe('mapFirebaseUser', () => {
  it('returns null for a null user', () => {
    expect(mapFirebaseUser(null)).toBeNull();
  });

  it('extracts only the fields the app uses', () => {
    const fakeUser = {
      uid: 'uid123',
      email: 'a@b.com',
      displayName: 'Ada',
      photoURL: null,
      extraFieldFirebaseAddsThatWeDontWant: 'ignored',
    } as unknown as User;

    expect(mapFirebaseUser(fakeUser)).toEqual({
      uid: 'uid123',
      email: 'a@b.com',
      displayName: 'Ada',
      photoURL: null,
    });
  });
});

describe('getAuthErrorMessage', () => {
  it('maps a known Firebase Auth error code to a friendly message', () => {
    expect(getAuthErrorMessage({ code: 'auth/wrong-password' })).toBe('Incorrect password.');
  });

  it('falls back to a generic message for an unrecognized code', () => {
    expect(getAuthErrorMessage({ code: 'auth/some-new-error-code' })).toBe('Something went wrong. Please try again.');
  });

  it('falls back to a generic message for a non-Firebase error', () => {
    expect(getAuthErrorMessage(new Error('boom'))).toBe('Something went wrong. Please try again.');
    expect(getAuthErrorMessage('a plain string')).toBe('Something went wrong. Please try again.');
  });

  it('surfaces our own Firebase-not-configured message verbatim instead of masking it', () => {
    const message = 'Firebase is not configured — missing EXPO_PUBLIC_FIREBASE_* env var(s) for: apiKey.';
    expect(getAuthErrorMessage(new Error(message))).toBe(message);
  });
});
