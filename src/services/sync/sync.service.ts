import { pullChangedDocs, pushDoc } from '@/services/cloud/firestore/collection';
import { isOnline } from '@/services/connectivity';
import {
  getChangedLocalRows,
  getLocalRowTimestamp,
  getSyncMetadata,
  recordSyncFailure,
  resolveSyncFailure,
  setSyncMetadata,
  upsertLocalRow,
} from '@/database/repositories/syncRepository';
import { logConflict, resolveConflict } from './sync.conflicts';
import { cloudDocToLocalRow, localRowToCloudDoc } from './sync.mapper';
import { SYNC_ENTITIES } from './sync.entities';
import type { EntitySyncResult, SyncEntityConfig } from './sync.types';

async function pushEntity(uid: string, entity: SyncEntityConfig): Promise<Pick<EntitySyncResult, 'pushed' | 'failed'>> {
  const { lastSyncedAt } = await getSyncMetadata(entity.tableName);
  const rows = await getChangedLocalRows(entity, lastSyncedAt);
  const syncStartedAt = new Date().toISOString();
  let pushed = 0;
  let failed = 0;

  for (const row of rows) {
    const id = row.id as string;
    try {
      await pushDoc(uid, entity, id, localRowToCloudDoc(row, entity));
      await resolveSyncFailure(entity.tableName, id);
      pushed += 1;
    } catch (error) {
      failed += 1;
      const operation = row.deleted_at ? 'delete' : 'update';
      await recordSyncFailure(entity.tableName, id, operation, row, error instanceof Error ? error.message : String(error));
    }
  }

  // Only advance the watermark if every row in this batch pushed — pushes are
  // idempotent (setDoc + merge), so re-sending everything next round is safe
  // and simpler than partial-watermark bookkeeping. See docs/FIREBASE.md.
  if (failed === 0) {
    await setSyncMetadata(entity.tableName, { lastSyncedAt: syncStartedAt });
  }

  return { pushed, failed };
}

async function pullEntity(uid: string, entity: SyncEntityConfig): Promise<Pick<EntitySyncResult, 'pulled' | 'conflicts'>> {
  const { lastPulledAt, lastSyncedAt } = await getSyncMetadata(entity.tableName);
  const pullStartedAt = new Date().toISOString();
  const remoteDocs = await pullChangedDocs(uid, entity, lastPulledAt);

  let pulled = 0;
  let conflicts = 0;

  for (const doc of remoteDocs) {
    const id = doc.id as string;
    const row = cloudDocToLocalRow(doc, entity);
    const remoteTimestamp = row[entity.timestampColumn] as string;
    const localTimestamp = await getLocalRowTimestamp(entity, id);

    if (localTimestamp === null) {
      await upsertLocalRow(entity, row);
      pulled += 1;
      continue;
    }

    const resolution = resolveConflict(localTimestamp, remoteTimestamp, lastSyncedAt);
    logConflict(entity.tableName, id, resolution);
    if (resolution.hadConflict) conflicts += 1;

    if (resolution.winner === 'remote') {
      await upsertLocalRow(entity, row);
      pulled += 1;
    }
  }

  await setSyncMetadata(entity.tableName, { lastPulledAt: pullStartedAt });
  return { pulled, conflicts };
}

async function syncEntity(uid: string, entity: SyncEntityConfig): Promise<EntitySyncResult> {
  try {
    const pushResult = await pushEntity(uid, entity);
    const pullResult = await pullEntity(uid, entity);
    return { tableName: entity.tableName, ...pushResult, ...pullResult };
  } catch (error) {
    return {
      tableName: entity.tableName,
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      failed: 1,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export interface SyncRunOutcome {
  ok: boolean;
  /** Present when ok is false and no sync was attempted at all (e.g. offline). */
  reason?: string;
  results?: EntitySyncResult[];
}

/**
 * Runs push-then-pull for every registered entity. Checks connectivity
 * once up front and bails out immediately if offline, rather than letting
 * every entity's Firestore call fail individually (see docs/FIREBASE.md
 * "Connectivity" — this app does not retry-loop against a known-dead
 * network).
 */
export async function runFullSync(uid: string): Promise<SyncRunOutcome> {
  if (!(await isOnline())) {
    return { ok: false, reason: 'offline' };
  }

  const results: EntitySyncResult[] = [];
  for (const entity of SYNC_ENTITIES) {
    results.push(await syncEntity(uid, entity));
  }

  const ok = results.every((r) => r.failed === 0);
  return { ok, results };
}
