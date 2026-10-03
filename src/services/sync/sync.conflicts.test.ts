import { resolveConflict } from './sync.conflicts';

describe('resolveConflict', () => {
  it('picks remote when it changed after local and both changed since last sync', () => {
    const result = resolveConflict('2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z', '2025-12-01T00:00:00.000Z');
    expect(result.winner).toBe('remote');
    expect(result.hadConflict).toBe(true);
  });

  it('picks local when it changed after remote and both changed since last sync', () => {
    const result = resolveConflict('2026-01-02T00:00:00.000Z', '2026-01-01T00:00:00.000Z', '2025-12-01T00:00:00.000Z');
    expect(result.winner).toBe('local');
    expect(result.hadConflict).toBe(true);
  });

  it('is not a conflict when only remote changed since the last sync', () => {
    const lastSyncedAt = '2026-01-01T00:00:00.000Z';
    const result = resolveConflict('2025-01-01T00:00:00.000Z', '2026-01-05T00:00:00.000Z', lastSyncedAt);
    expect(result.winner).toBe('remote');
    expect(result.hadConflict).toBe(false);
  });

  it('is not a conflict when only local changed since the last sync', () => {
    const lastSyncedAt = '2026-01-01T00:00:00.000Z';
    const result = resolveConflict('2026-01-05T00:00:00.000Z', '2025-01-01T00:00:00.000Z', lastSyncedAt);
    expect(result.winner).toBe('local');
    expect(result.hadConflict).toBe(false);
  });

  it('is not a conflict when both sides are already identical', () => {
    const sameTimestamp = '2026-01-05T00:00:00.000Z';
    const result = resolveConflict(sameTimestamp, sameTimestamp, '2025-01-01T00:00:00.000Z');
    expect(result.hadConflict).toBe(false);
  });

  it('treats a never-synced table conservatively (both sides considered changed)', () => {
    const result = resolveConflict('2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z', null);
    expect(result.hadConflict).toBe(true);
    expect(result.winner).toBe('remote');
  });
});
