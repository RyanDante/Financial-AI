import type { ConflictResolution } from './sync.types';

/**
 * V1 conflict policy: latest `updatedAt` wins. This never silently drops
 * the losing side's unsynced work — the loser is simply not written this
 * round; if it was the local copy, its own `updated_at` is still > the
 * last-synced watermark, so the NEXT push pass re-sends it against
 * whatever is in the cloud by then. Nothing here deletes data, and every
 * real conflict (both sides changed independently since the last
 * successful sync) is logged via logConflict so it's visible rather than
 * silent. A richer strategy (field-level merge, user prompts) can replace
 * this function later without touching its callers.
 */
export function resolveConflict(localUpdatedAt: string, remoteUpdatedAt: string, lastSyncedAt: string | null): ConflictResolution {
  const localChangedSinceSync = lastSyncedAt === null || localUpdatedAt > lastSyncedAt;
  const remoteChangedSinceSync = lastSyncedAt === null || remoteUpdatedAt > lastSyncedAt;
  const hadConflict = localChangedSinceSync && remoteChangedSinceSync && localUpdatedAt !== remoteUpdatedAt;
  const winner = remoteUpdatedAt > localUpdatedAt ? 'remote' : 'local';
  return { winner, hadConflict };
}

export function logConflict(tableName: string, recordId: string, resolution: ConflictResolution): void {
  if (!resolution.hadConflict) return;
  console.warn(
    `[sync] conflict on ${tableName}/${recordId}: both local and remote changed since the last sync; ${resolution.winner} (latest updatedAt) won.`,
  );
}
