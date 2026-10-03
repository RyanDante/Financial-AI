import * as Crypto from 'expo-crypto';
import { getDatabase } from '../client';
import type { Account, AccountType } from '@/types/finance';
import type { CurrencyCode } from '@/constants/currencies';

interface AccountRow {
  id: string;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  initial_balance_minor: number;
  color: string | null;
  icon: string | null;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

function mapRow(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    currency: row.currency,
    initialBalanceMinor: row.initial_balance_minor,
    color: row.color,
    icon: row.icon,
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAccounts(includeArchived = false): Promise<Account[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AccountRow>(
    `SELECT * FROM accounts WHERE deleted_at IS NULL ${includeArchived ? '' : 'AND is_archived = 0'} ORDER BY created_at ASC`,
  );
  return rows.map(mapRow);
}

export async function getAccountById(id: string): Promise<Account | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<AccountRow>('SELECT * FROM accounts WHERE id = ? AND deleted_at IS NULL', id);
  return row ? mapRow(row) : null;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  initialBalanceMinor: number;
  color?: string | null;
  icon?: string | null;
}

export async function createAccount(input: CreateAccountInput): Promise<Account> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO accounts (id, name, type, currency, initial_balance_minor, color, icon, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.name,
    input.type,
    input.currency,
    input.initialBalanceMinor,
    input.color ?? null,
    input.icon ?? null,
    now,
    now,
  );
  const account = await getAccountById(id);
  if (!account) throw new Error('Failed to create account');
  return account;
}

export async function updateAccount(id: string, patch: Partial<CreateAccountInput & { isArchived: boolean }>): Promise<Account> {
  const db = await getDatabase();
  const existing = await getAccountById(id);
  if (!existing) throw new Error(`Account ${id} not found`);
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE accounts SET name = ?, type = ?, currency = ?, initial_balance_minor = ?, color = ?, icon = ?, is_archived = ?, updated_at = ?, version = version + 1
     WHERE id = ?`,
    patch.name ?? existing.name,
    patch.type ?? existing.type,
    patch.currency ?? existing.currency,
    patch.initialBalanceMinor ?? existing.initialBalanceMinor,
    patch.color ?? existing.color,
    patch.icon ?? existing.icon,
    (patch.isArchived ?? existing.isArchived) ? 1 : 0,
    now,
    id,
  );
  const updated = await getAccountById(id);
  if (!updated) throw new Error('Failed to update account');
  return updated;
}

export async function deleteAccount(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync('UPDATE accounts SET deleted_at = ?, updated_at = ? WHERE id = ?', now, now, id);
}
