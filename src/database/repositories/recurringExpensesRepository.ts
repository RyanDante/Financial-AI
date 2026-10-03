import * as Crypto from 'expo-crypto';
import { getDatabase } from '../client';
import type { RecurrenceFrequency, RecurringExpense } from '@/types/finance';
import type { CurrencyCode } from '@/constants/currencies';

interface RecurringExpenseRow {
  id: string;
  name: string;
  category_id: string | null;
  amount_minor: number;
  currency: CurrencyCode;
  frequency: RecurrenceFrequency;
  next_due_at: string | null;
  is_active: number;
}

function mapRow(row: RecurringExpenseRow): RecurringExpense {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    amountMinor: row.amount_minor,
    currency: row.currency,
    frequency: row.frequency,
    nextDueAt: row.next_due_at,
    isActive: row.is_active === 1,
  };
}

export async function listRecurringExpenses(activeOnly = true): Promise<RecurringExpense[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RecurringExpenseRow>(
    `SELECT * FROM recurring_expenses WHERE deleted_at IS NULL ${activeOnly ? 'AND is_active = 1' : ''} ORDER BY name ASC`,
  );
  return rows.map(mapRow);
}

export interface CreateRecurringExpenseInput {
  name: string;
  categoryId?: string | null;
  amountMinor: number;
  currency: CurrencyCode;
  frequency: RecurrenceFrequency;
  nextDueAt?: string | null;
}

export async function createRecurringExpense(input: CreateRecurringExpenseInput): Promise<RecurringExpense> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO recurring_expenses (id, name, category_id, amount_minor, currency, frequency, next_due_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.name,
    input.categoryId ?? null,
    input.amountMinor,
    input.currency,
    input.frequency,
    input.nextDueAt ?? null,
    now,
    now,
  );
  return { ...input, id, categoryId: input.categoryId ?? null, nextDueAt: input.nextDueAt ?? null, isActive: true };
}
