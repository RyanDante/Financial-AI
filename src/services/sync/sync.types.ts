export type SyncOperation = 'create' | 'update' | 'delete';
export type SyncDirection = 'push' | 'pull';
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error' | 'blocked';

/**
 * Describes one syncable SQLite table <-> Firestore collection pair. The
 * sync engine is generic over this config rather than having one bespoke
 * push/pull function per entity (there are 13 of these and the logic is
 * identical for all of them) — see docs/ARCHITECTURE.md "Sync engine".
 */
export interface SyncEntityConfig {
  /** SQLite table name, e.g. "transactions". */
  tableName: string;
  /** Firestore subcollection name under users/{uid}/, e.g. "transactions". */
  collectionName: string;
  /**
   * Exact business-column names to sync, in snake_case as they appear in
   * SQLite. Deliberately explicit (not "whatever columns exist") so a
   * remote document can never inject a column we didn't intend to sync.
   */
  columns: string[];
  /** Which local column marks "last changed" for diffing. Defaults to 'updated_at'. */
  timestampColumn: 'updated_at' | 'created_at';
  /** Whether this table has a deleted_at column (soft-delete tombstones get pushed/pulled). */
  supportsSoftDelete: boolean;
}

export interface SyncQueueItem {
  id: string;
  tableName: string;
  recordId: string;
  operation: SyncOperation;
  payload: unknown;
  createdAt: string;
  attempts: number;
  lastAttemptAt: string | null;
  error: string | null;
  syncedAt: string | null;
}

export interface ConflictResolution {
  winner: 'local' | 'remote';
  /** True only when BOTH sides changed independently since the last successful sync — a genuine conflict, not just "remote happened to be newer". */
  hadConflict: boolean;
}

export interface EntitySyncResult {
  tableName: string;
  pushed: number;
  pulled: number;
  conflicts: number;
  failed: number;
  error?: string;
}
