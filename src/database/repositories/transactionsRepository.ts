import * as Crypto from 'expo-crypto';
import { getDatabase } from '../client';
import type { NewTransaction, Transaction, TransactionType } from '@/types/finance';
import type { CurrencyCode } from '@/constants/currencies';

interface TransactionRow {
  id: string;
  account_id: string;
  category_id: string | null;
  transfer_account_id: string | null;
  amount_minor: number;
  currency: CurrencyCode;
  type: TransactionType;
  merchant: string | null;
  description: string | null;
  notes: string | null;
  occurred_at: string;
  source: Transaction['source'];
  created_at: string;
  updated_at: string;
}

function mapRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    accountId: row.account_id,
    categoryId: row.category_id,
    transferAccountId: row.transfer_account_id,
    amountMinor: row.amount_minor,
    currency: row.currency,
    type: row.type,
    merchant: row.merchant,
    description: row.description,
    notes: row.notes,
    occurredAt: row.occurred_at,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface TransactionFilter {
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  from?: string;
  to?: string;
  limit?: number;
}

export async function listTransactions(filter: TransactionFilter = {}): Promise<Transaction[]> {
  const db = await getDatabase();
  const conditions = ['deleted_at IS NULL'];
  const params: string[] = [];

  if (filter.accountId) {
    conditions.push('account_id = ?');
    params.push(filter.accountId);
  }
  if (filter.categoryId) {
    conditions.push('category_id = ?');
    params.push(filter.categoryId);
  }
  if (filter.type) {
    conditions.push('type = ?');
    params.push(filter.type);
  }
  if (filter.from) {
    conditions.push('occurred_at >= ?');
    params.push(filter.from);
  }
  if (filter.to) {
    conditions.push('occurred_at <= ?');
    params.push(filter.to);
  }

  const limitClause = filter.limit ? `LIMIT ${Number(filter.limit)}` : '';
  const rows = await db.getAllAsync<TransactionRow>(
    `SELECT * FROM transactions WHERE ${conditions.join(' AND ')} ORDER BY occurred_at DESC ${limitClause}`,
    ...params,
  );
  return rows.map(mapRow);
}

export async function getTransactionById(id: string): Promise<Transaction | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<TransactionRow>('SELECT * FROM transactions WHERE id = ? AND deleted_at IS NULL', id);
  return row ? mapRow(row) : null;
}

export async function createTransaction(input: NewTransaction): Promise<Transaction> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO transactions (
      id, account_id, category_id, transfer_account_id, amount_minor, currency, type,
      merchant, description, notes, occurred_at, source, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.accountId,
    input.categoryId,
    input.transferAccountId,
    input.amountMinor,
    input.currency,
    input.type,
    input.merchant,
    input.description,
    input.notes,
    input.occurredAt,
    input.source,
    now,
    now,
  );
  const transaction = await getTransactionById(id);
  if (!transaction) throw new Error('Failed to create transaction');
  return transaction;
}

export async function updateTransaction(id: string, patch: Partial<NewTransaction>): Promise<Transaction> {
  const db = await getDatabase();
  const existing = await getTransactionById(id);
  if (!existing) throw new Error(`Transaction ${id} not found`);
  const now = new Date().toISOString();
  const merged = { ...existing, ...patch };
  await db.runAsync(
    `UPDATE transactions SET
      account_id = ?, category_id = ?, transfer_account_id = ?, amount_minor = ?, currency = ?, type = ?,
      merchant = ?, description = ?, notes = ?, occurred_at = ?, source = ?, updated_at = ?, version = version + 1
     WHERE id = ?`,
    merged.accountId,
    merged.categoryId,
    merged.transferAccountId,
    merged.amountMinor,
    merged.currency,
    merged.type,
    merged.merchant,
    merged.description,
    merged.notes,
    merged.occurredAt,
    merged.source,
    now,
    id,
  );
  const updated = await getTransactionById(id);
  if (!updated) throw new Error('Failed to update transaction');
  return updated;
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync('UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ?', now, now, id);
}
