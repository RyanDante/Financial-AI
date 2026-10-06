import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Debts can now go either way: money the user owes ("i_owe", the only kind
 * before this migration, so existing rows keep that meaning) and money
 * owed to the user ("owed_to_me"), plus who the other person is. Purely
 * additive: no existing column or row changes.
 */
export async function migrateDebtDirection(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    ALTER TABLE debts ADD COLUMN direction TEXT NOT NULL DEFAULT 'i_owe';
    ALTER TABLE debts ADD COLUMN counterparty TEXT;
  `);
}
