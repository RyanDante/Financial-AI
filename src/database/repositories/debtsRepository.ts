import * as Crypto from 'expo-crypto';
import { getDatabase } from '../client';
import type { Debt } from '@/types/finance';
import type { CurrencyCode } from '@/constants/currencies';

interface DebtRow {
  id: string;
  name: string;
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
    `INSERT INTO debts (id, name, principal_minor, remaining_minor, currency, interest_rate, minimum_payment_minor, due_day_of_month, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.name,
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
    principalMinor: input.principalMinor,
    remainingMinor: input.remainingMinor,
    currency: input.currency,
    interestRate: input.interestRate ?? 0,
    minimumPaymentMinor: input.minimumPaymentMinor ?? 0,
    dueDayOfMonth: input.dueDayOfMonth ?? null,
  };
}
