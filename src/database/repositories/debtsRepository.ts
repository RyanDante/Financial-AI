import * as Crypto from 'expo-crypto';
import { getDatabase } from '../client';
import type { Debt, DebtDirection } from '@/types/finance';
import type { CurrencyCode } from '@/constants/currencies';

interface DebtRow {
  id: string;
  name: string;
  direction: DebtDirection;
  counterparty: string | null;
  principal_minor: number;
  remaining_minor: number;
  currency: CurrencyCode;
  interest_rate: number;
  minimum_payment_minor: number;
  due_day_of_month: number | null;
}

function mapRow(row: DebtRow): Debt {
  return {
    id: row.id,
    name: row.name,
    direction: row.direction ?? 'i_owe',
    counterparty: row.counterparty ?? null,
    principalMinor: row.principal_minor,
    remainingMinor: row.remaining_minor,
    currency: row.currency,
    interestRate: row.interest_rate,
    minimumPaymentMinor: row.minimum_payment_minor,
    dueDayOfMonth: row.due_day_of_month,
  };
}

export async function listDebts(): Promise<Debt[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<DebtRow>('SELECT * FROM debts WHERE deleted_at IS NULL ORDER BY name ASC');
  return rows.map(mapRow);
}

export interface CreateDebtInput {
  name: string;
  direction?: DebtDirection;
  counterparty?: string | null;
  principalMinor: number;
  remainingMinor: number;
  currency: CurrencyCode;
  interestRate?: number;
  minimumPaymentMinor?: number;
  dueDayOfMonth?: number | null;
}

export async function createDebt(input: CreateDebtInput): Promise<Debt> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO debts (id, name, direction, counterparty, principal_minor, remaining_minor, currency, interest_rate, minimum_payment_minor, due_day_of_month, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.name,
    input.direction ?? 'i_owe',
    input.counterparty ?? null,
    input.principalMinor,
    input.remainingMinor,
    input.currency,
    input.interestRate ?? 0,
    input.minimumPaymentMinor ?? 0,
    input.dueDayOfMonth ?? null,
    now,
    now,
  );
  return {
    id,
    name: input.name,
    direction: input.direction ?? 'i_owe',
    counterparty: input.counterparty ?? null,
    principalMinor: input.principalMinor,
    remainingMinor: input.remainingMinor,
    currency: input.currency,
    interestRate: input.interestRate ?? 0,
    minimumPaymentMinor: input.minimumPaymentMinor ?? 0,
    dueDayOfMonth: input.dueDayOfMonth ?? null,
  };
}

/**
 * Records a repayment (either direction): lowers what's left, never below
 * zero. Returns the updated debt so callers can tell when it's settled.
 */
export async function recordDebtPayment(id: string, amountMinor: number): Promise<Debt | null> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE debts SET remaining_minor = MAX(0, remaining_minor - ?), updated_at = ?, version = version + 1 WHERE id = ? AND deleted_at IS NULL',
    amountMinor,
    now,
    id,
  );
  const row = await db.getFirstAsync<DebtRow>('SELECT * FROM debts WHERE id = ? AND deleted_at IS NULL', id);
  return row ? mapRow(row) : null;
}

/** Soft delete, so sync removes it from the cloud too. */
export async function deleteDebt(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync('UPDATE debts SET deleted_at = ?, updated_at = ?, version = version + 1 WHERE id = ?', now, now, id);
}
