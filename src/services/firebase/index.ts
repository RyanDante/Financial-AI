/**
 * Convenience barrel for code that genuinely needs more than one Firebase
 * service. Prefer importing the specific submodule (e.g.
 * `@/services/firebase/storage`) when you only need one — importing this
 * barrel evaluates every submodule, including auth.ts, which pulls in
 * @react-native-async-storage/async-storage's native module. That's fine
 * at runtime, but it has no native bridge under Jest, so a test importing
 * this barrel (even indirectly, through a file that only needed Firestore
 * or Storage) fails for a reason that has nothing to do with what it's
 * actually testing. See storage.test.ts / collection.ts for the fix this
 * bit twice before this comment existed.
 */
export * from './config';
export * from './app';
export * from './auth';
export * from './firestore';
export * from './storage';
