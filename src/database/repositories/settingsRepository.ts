import { getDatabase } from '../client';

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    key,
    value,
    now,
  );
}

/** Removes a setting so readers fall back to their computed default. Settings are local-only (not synced). */
export async function deleteSetting(key: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM settings WHERE key = ?', key);
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string | null }>('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map((r) => [r.key, r.value ?? '']));
}
