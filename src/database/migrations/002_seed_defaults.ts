import type { SQLiteDatabase } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { DEFAULT_CATEGORIES } from '../seed/defaultCategories';
import { DEFAULT_CURRENCY } from '@/constants/currencies';

/**
 * Seeds the default category set and a starter cash account so the app has
 * something meaningful to show on first launch, without requiring an
 * onboarding flow to exist yet.
 */
export async function seedDefaults(db: SQLiteDatabase): Promise<void> {
  const now = new Date().toISOString();

  for (const category of DEFAULT_CATEGORIES) {
    await db.runAsync(
      `INSERT INTO categories (id, name, icon, color, type, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      Crypto.randomUUID(),
      category.name,
      category.icon,
      category.color,
      category.type,
      now,
      now,
    );
  }

  await db.runAsync(
    `INSERT INTO accounts (id, name, type, currency, initial_balance_minor, color, icon, created_at, updated_at)
     VALUES (?, 'Cash', 'cash', ?, 0, ?, 'wallet', ?, ?)`,
    Crypto.randomUUID(),
    DEFAULT_CURRENCY,
    '#7C5CFC',
    now,
    now,
  );

  await db.runAsync(
    `INSERT INTO settings (key, value, updated_at) VALUES ('default_currency', ?, ?)`,
    DEFAULT_CURRENCY,
    now,
  );
}
