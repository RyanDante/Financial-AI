import * as Crypto from 'expo-crypto';
import { getDatabase } from '../client';
import type { IncomeSource, RecurrenceFrequency } from '@/types/finance';
import type { CurrencyCode } from '@/constants/currencies';

interface IncomeRow {
  id: string;
  account_id: string | null;
  source: string;
  amount_minor: number;
  currency: CurrencyCode;
  frequency: RecurrenceFrequency;
  next_expected_at: string | null;
  is_active: number;
}

function mapRow(row: IncomeRow): IncomeSource {
  return {
    id: row.id,
    accountId: row.account_id,
    source: row.source,
    amountMinor: row.amount_minor,
    currency: row.currency,
    frequency: row.frequency,
    nextExpectedAt: row.next_expected_at,
    isActive: row.is_active === 1,
  };
}

export async function listIncomeSources(activeOnly = true): Promise<IncomeSource[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<IncomeRow>(
    `SELECT * FROM income WHERE deleted_at IS NULL ${activeOnly ? 'AND is_active = 1' : ''} ORDER BY source ASC`,
  );
  return rows.map(mapRow);
}

export interface CreateIncomeInput {
  accountId?: string | null;
  source: string;
  amountMinor: number;
  currency: CurrencyCode;
  frequency: RecurrenceFrequency;
  nextExpectedAt?: string | null;
}

export async function createIncomeSource(input: CreateIncomeInput): Promise<IncomeSource> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO income (id, account_id, source, amount_minor, currency, frequency, next_expected_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.accountId ?? null,
    input.source,
    input.amountMinor,
    input.currency,
    input.frequency,
    input.nextExpectedAt ?? null,
    now,
    now,
  );
  return {
    ...input,
    id,
    accountId: input.accountId ?? null,
    nextExpectedAt: input.nextExpectedAt ?? null,
    isActive: true,
  };
}
