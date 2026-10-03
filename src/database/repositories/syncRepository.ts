import * as Crypto from 'expo-crypto';
import { getDatabase } from '../client';
import type { SyncEntityConfig, SyncOperation, SyncQueueItem } from '@/services/sync/sync.types';

type BindableValue = string | number | null;

function toBindable(value: unknown): BindableValue {
  return value as BindableValue;
}

function selectableColumns(entity: SyncEntityConfig): string[] {
  const columns = ['id', ...entity.columns, 'created_at'];
  if (entity.timestampColumn === 'updated_at') columns.push('updated_at');
  if (entity.supportsSoftDelete) columns.push('deleted_at');
  return columns;
}

/** Raw local rows changed since `sinceIso` (or all rows, if null) — the basis for push diffing. */
export async function getChangedLocalRows(entity: SyncEntityConfig, sinceIso: string | null): Promise<Record<string, unknown>[]> {
  const db = await getDatabase();
  const columns = selectableColumns(entity);
  const sql = `SELECT ${columns.join(', ')} FROM ${entity.tableName}${sinceIso ? ` WHERE ${entity.timestampColumn} > ?` : ''}`;
  return sinceIso ? db.getAllAsync<Record<string, unknown>>(sql, sinceIso) : db.getAllAsync<Record<string, unknown>>(sql);
}

/** The local row's diffing timestamp, or null if no local row with that id exists yet. */
export async function getLocalRowTimestamp(entity: SyncEntityConfig, id: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT ${entity.timestampColumn} AS ts FROM ${entity.tableName} WHERE id = ?`,
    id,
  );
  return (row?.ts as string | undefined) ?? null;
}

/** Inserts a new local row, or overwrites an existing one by id, from a (already-mapped, snake_case) remote row. */
export async function upsertLocalRow(entity: SyncEntityConfig, row: Record<string, unknown>): Promise<void> {
  const db = await getDatabase();
  const columns = selectableColumns(entity);
  const existing = await db.getFirstAsync<{ id: string }>(`SELECT id FROM ${entity.tableName} WHERE id = ?`, row.id as string);

  if (!existing) {
    const placeholders = columns.map(() => '?').join(', ');
    await db.runAsync(
      `INSERT INTO ${entity.tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
      ...columns.map((c) => toBindable(row[c] ?? null)),
    );
    return;
  }

  const updateColumns = columns.filter((c) => c !== 'id');
  const setClause = updateColumns.map((c) => `${c} = ?`).join(', ');
  await db.runAsync(
    `UPDATE ${entity.tableName} SET ${setClause} WHERE id = ?`,
    ...updateColumns.map((c) => toBindable(row[c] ?? null)),
    row.id as string,
  );
}

export interface SyncMetadata {
  lastSyncedAt: string | null;
  lastPulledAt: string | null;
}

export async function getSyncMetadata(tableName: string): Promise<SyncMetadata> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ last_synced_at: string | null; last_pulled_at: string | null }>(
    'SELECT last_synced_at, last_pulled_at FROM sync_metadata WHERE table_name = ?',
    tableName,
  );
  return { lastSyncedAt: row?.last_synced_at ?? null, lastPulledAt: row?.last_pulled_at ?? null };
}

export async function setSyncMetadata(tableName: string, patch: Partial<SyncMetadata>): Promise<void> {
  const db = await getDatabase();
  const existing = await getSyncMetadata(tableName);
  await db.runAsync(
    `INSERT INTO sync_metadata (table_name, last_synced_at, last_pulled_at) VALUES (?, ?, ?)
     ON CONFLICT(table_name) DO UPDATE SET last_synced_at = excluded.last_synced_at, last_pulled_at = excluded.last_pulled_at`,
    tableName,
    patch.lastSyncedAt ?? existing.lastSyncedAt,
    patch.lastPulledAt ?? existing.lastPulledAt,
  );
}

interface SyncQueueRow {
  id: string;
  table_name: string;
  record_id: string;
  operation: SyncOperation;
  payload_json: string | null;
  created_at: string;
  attempts: number;
  last_attempt_at: string | null;
  error: string | null;
  synced_at: string | null;
}

function mapQueueRow(row: SyncQueueRow): SyncQueueItem {
  return {
    id: row.id,
    tableName: row.table_name,
    recordId: row.record_id,
    operation: row.operation,
    payload: row.payload_json ? JSON.parse(row.payload_json) : null,
    createdAt: row.created_at,
    attempts: row.attempts,
    lastAttemptAt: row.last_attempt_at,
    error: row.error,
    syncedAt: row.synced_at,
  };
}

/**
 * Records (or bumps the attempt count on) a failed push for one record.
 * This is a durable log for the Sync Status UI, not the retry driver
 * itself — see docs/FIREBASE.md "Sync engine" for why re-running sync is
 * what actually retries a failed push.
 */
export async function recordSyncFailure(tableName: string, recordId: string, operation: SyncOperation, payload: unknown, error: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const existing = await db.getFirstAsync<{ id: string; attempts: number }>(
    'SELECT id, attempts FROM sync_queue WHERE table_name = ? AND record_id = ? AND synced_at IS NULL',
    tableName,
    recordId,
  );

  if (existing) {
    await db.runAsync(
      'UPDATE sync_queue SET attempts = ?, last_attempt_at = ?, error = ?, payload_json = ? WHERE id = ?',
      existing.attempts + 1,
      now,
      error,
      JSON.stringify(payload),
      existing.id,
    );
  } else {
    await db.runAsync(
      `INSERT INTO sync_queue (id, table_name, record_id, operation, payload_json, created_at, attempts, last_attempt_at, error)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      Crypto.randomUUID(),
      tableName,
      recordId,
      operation,
      JSON.stringify(payload),
      now,
      now,
      error,
    );
  }
}

/** Clears a record's failure log once it has pushed successfully. */
export async function resolveSyncFailure(tableName: string, recordId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE sync_queue SET synced_at = ? WHERE table_name = ? AND record_id = ? AND synced_at IS NULL',
    new Date().toISOString(),
    tableName,
    recordId,
  );
}

export async function listPendingSyncFailures(): Promise<SyncQueueItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SyncQueueRow>('SELECT * FROM sync_queue WHERE synced_at IS NULL ORDER BY created_at ASC');
  return rows.map(mapQueueRow);
}
