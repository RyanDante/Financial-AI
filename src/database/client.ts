import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { MIGRATIONS } from './migrations';

const DATABASE_NAME = 'f-ai.db';

let dbPromise: Promise<SQLiteDatabase> | null = null;

async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = row?.user_version ?? 0;

  const pending = MIGRATIONS.filter((m) => m.version > currentVersion).sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    await db.withTransactionAsync(async () => {
      await migration.up(db);
    });
    currentVersion = migration.version;
    await db.execAsync(`PRAGMA user_version = ${currentVersion}`);
  }
}

/**
 * Lazily opens (and migrates) the single app-wide SQLite connection. Every
 * repository and AI tool goes through this instead of opening its own
 * connection, so the app stays offline-first with one consistent view of
 * the data regardless of whether the caller is a React component, a
 * Zustand store action, or an AI tool executor.
 */
export function getDatabase(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await runMigrations(db);
      return db;
    })();
  }
  return dbPromise;
}

/** Test-only escape hatch: forces the next getDatabase() call to re-open. */
export function __resetDatabaseForTests(): void {
  dbPromise = null;
}
