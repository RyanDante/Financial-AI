import { Timestamp } from 'firebase/firestore';
import { cloudDocToLocalRow, isoToTimestamp, localRowToCloudDoc, timestampToIso } from './sync.mapper';
import type { SyncEntityConfig } from './sync.types';

const accountEntity: SyncEntityConfig = {
  tableName: 'accounts',
  collectionName: 'accounts',
  columns: ['name', 'currency', 'initial_balance_minor', 'is_archived'],
  timestampColumn: 'updated_at',
  supportsSoftDelete: true,
};

const snapshotEntity: SyncEntityConfig = {
  tableName: 'financial_snapshots',
  collectionName: 'financialSnapshots',
  columns: ['balance_minor'],
  timestampColumn: 'created_at',
  supportsSoftDelete: false,
};

describe('isoToTimestamp / timestampToIso', () => {
  it('round-trips an ISO string through a Firestore Timestamp', () => {
    const iso = '2026-03-15T12:30:00.000Z';
    expect(timestampToIso(isoToTimestamp(iso))).toBe(iso);
  });

  it('passes through a plain string unchanged (defensive — some docs may already be strings)', () => {
    expect(timestampToIso('2026-01-01T00:00:00.000Z')).toBe('2026-01-01T00:00:00.000Z');
  });

  it('returns null for a null/undefined timestamp', () => {
    expect(timestampToIso(null)).toBeNull();
    expect(timestampToIso(undefined)).toBeNull();
  });
});

describe('localRowToCloudDoc', () => {
  it('converts snake_case columns to camelCase and timestamps to Firestore Timestamps', () => {
    const row = {
      id: 'acc_1',
      name: 'Cash',
      currency: 'XAF',
      initial_balance_minor: 50000,
      is_archived: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
      deleted_at: null,
      version: 3,
    };

    const doc = localRowToCloudDoc(row, accountEntity);

    expect(doc.id).toBe('acc_1');
    expect(doc.name).toBe('Cash');
    expect(doc.initialBalanceMinor).toBe(50000);
    expect(doc.isArchived).toBe(0);
    expect(doc.createdAt).toBeInstanceOf(Timestamp);
    expect(doc.updatedAt).toBeInstanceOf(Timestamp);
    expect(doc.deletedAt).toBeNull();
    // `version` isn't in the entity's column list, so it must not leak into the cloud doc.
    expect(doc.version).toBeUndefined();
  });

  it('omits deletedAt entirely for entities that do not support soft delete', () => {
    const row = { id: 'snap_1', balance_minor: 100, created_at: '2026-01-01T00:00:00.000Z' };
    const doc = localRowToCloudDoc(row, snapshotEntity);
    expect(doc.deletedAt).toBeUndefined();
    expect(doc.createdAt).toBeInstanceOf(Timestamp);
  });
});

describe('cloudDocToLocalRow', () => {
  it('is the exact inverse of localRowToCloudDoc for a round trip', () => {
    const row = {
      id: 'acc_1',
      name: 'Cash',
      currency: 'XAF',
      initial_balance_minor: 50000,
      is_archived: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
      deleted_at: null,
    };

    const roundTripped = cloudDocToLocalRow(localRowToCloudDoc(row, accountEntity), accountEntity);
    expect(roundTripped).toEqual(row);
  });
});
