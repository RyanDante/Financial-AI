import * as Crypto from 'expo-crypto';
import { getDatabase } from '../client';
import type { Subscription } from '@/types/finance';
import type { CurrencyCode } from '@/constants/currencies';

interface SubscriptionRow {
  id: string;
  name: string;
  category_id: string | null;
  amount_minor: number;
  currency: CurrencyCode;
  billing_cycle: 'monthly' | 'yearly';
  next_billing_at: string | null;
  is_active: number;
}

function mapRow(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    amountMinor: row.amount_minor,
    currency: row.currency,
    billingCycle: row.billing_cycle,
    nextBillingAt: row.next_billing_at,
    isActive: row.is_active === 1,
  };
}

export async function listSubscriptions(activeOnly = true): Promise<Subscription[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SubscriptionRow>(
    `SELECT * FROM subscriptions WHERE deleted_at IS NULL ${activeOnly ? 'AND is_active = 1' : ''} ORDER BY name ASC`,
  );
  return rows.map(mapRow);
}

export interface CreateSubscriptionInput {
  name: string;
  categoryId?: string | null;
  amountMinor: number;
  currency: CurrencyCode;
  billingCycle: 'monthly' | 'yearly';
  nextBillingAt?: string | null;
}

export async function createSubscription(input: CreateSubscriptionInput): Promise<Subscription> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO subscriptions (id, name, category_id, amount_minor, currency, billing_cycle, next_billing_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.name,
    input.categoryId ?? null,
    input.amountMinor,
    input.currency,
    input.billingCycle,
    input.nextBillingAt ?? null,
    now,
    now,
  );
  return { ...input, id, categoryId: input.categoryId ?? null, nextBillingAt: input.nextBillingAt ?? null, isActive: true };
}

export async function setSubscriptionActive(id: string, isActive: boolean): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync('UPDATE subscriptions SET is_active = ?, updated_at = ?, version = version + 1 WHERE id = ?', isActive ? 1 : 0, now, id);
}
