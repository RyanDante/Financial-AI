import type { SQLiteDatabase } from 'expo-sqlite';
import { MIGRATION_001_INITIAL } from './001_initial';
import { seedDefaults } from './002_seed_defaults';
import { migrateSyncAndFiles } from './003_sync_and_files';

export interface Migration {
  version: number;
  up: (db: SQLiteDatabase) => Promise<void>;
}

export const MIGRATIONS: Migration[] = [
  { version: 1, up: (db) => db.execAsync(MIGRATION_001_INITIAL) },
  { version: 2, up: (db) => seedDefaults(db) },
  { version: 3, up: (db) => migrateSyncAndFiles(db) },
];
