import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Adds retry bookkeeping to sync_queue (so a failed push attempt carries
 * enough information to retry and to surface in the Sync Status UI — see
 * docs/FIREBASE.md "Sync engine") and a file_uploads table to track
 * receipts/documents picked while offline until they reach Firebase
 * Storage (see docs/FIREBASE.md "Offline file handling"). Purely additive:
 * no existing column is changed or dropped, no existing row is touched.
 */
export async function migrateSyncAndFiles(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    ALTER TABLE sync_queue ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE sync_queue ADD COLUMN last_attempt_at TEXT;
    ALTER TABLE sync_queue ADD COLUMN error TEXT;

    CREATE TABLE file_uploads (
      id TEXT PRIMARY KEY NOT NULL,
      owner_entity_type TEXT NOT NULL,
      owner_entity_id TEXT,
      local_uri TEXT NOT NULL,
      storage_path TEXT,
      filename TEXT NOT NULL,
      mime_type TEXT,
      size_bytes INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      created_at TEXT NOT NULL,
      uploaded_at TEXT
    );
    CREATE INDEX idx_file_uploads_status ON file_uploads(status);
    CREATE INDEX idx_file_uploads_owner ON file_uploads(owner_entity_type, owner_entity_id);
  `);
}
