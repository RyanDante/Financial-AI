/**
 * Firebase client configuration, read from EXPO_PUBLIC_* env vars.
 *
 * These are CLIENT config values, not secrets — the Firebase API key here
 * identifies which Firebase project to talk to; it does not grant access by
 * itself (Firestore/Storage Security Rules do that, keyed off the signed-in
 * user's UID). It is still never acceptable to put a privileged credential
 * (an Admin SDK service-account JSON, a server API key) behind an
 * EXPO_PUBLIC_ prefix — those are compiled into the client bundle in plain
 * text. See docs/FIREBASE.md for the full explanation.
 *
 * Metro only inlines `process.env.EXPO_PUBLIC_*` when referenced as a static
 * dot-notation expression, so every variable is read individually below —
 * never build the key name dynamically.
 */
export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const REQUIRED_ENV: Record<keyof FirebaseClientConfig, string | undefined> = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

/** Pure — takes an env-like object so it's testable without process.env. */
export function getMissingFirebaseEnvKeys(env: Record<string, string | undefined> = REQUIRED_ENV): string[] {
  return Object.entries(env)
    .filter(([, value]) => !value)
    .map(([key]) => key);
}

export function isFirebaseConfigured(): boolean {
  return getMissingFirebaseEnvKeys().length === 0;
}

/** Throws with a precise, actionable message if any required value is missing. */
export function getFirebaseConfig(): FirebaseClientConfig {
  const missing = getMissingFirebaseEnvKeys();
  if (missing.length > 0) {
    throw new Error(
      `Firebase is not configured — missing EXPO_PUBLIC_FIREBASE_* env var(s) for: ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill in your Firebase project config (see docs/FIREBASE.md).',
    );
  }
  return REQUIRED_ENV as FirebaseClientConfig;
}
