import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirebaseConfig } from './config';

let app: FirebaseApp | null = null;

/**
 * Lazily initializes the single Firebase app instance. Nothing in this
 * module runs at import time — importing it (even transitively, e.g. for a
 * type) never triggers initialization or throws if env vars are missing.
 * Only calling getFirebaseApp() does, and only the first time.
 */
export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  const existing = getApps();
  app = existing.length > 0 ? existing[0] : initializeApp(getFirebaseConfig());
  return app;
}
