import * as Crypto from 'expo-crypto';
import { getDatabase } from '../client';
import type { Budget, BudgetCategory } from '@/types/finance';
import type { CurrencyCode } from '@/constants/currencies';

interface BudgetRow {
  id: string;
  name: string;
  period: 'monthly';
  month: string;
  total_limit_minor: number | null;
  currency: CurrencyCode;
  created_at: string;
  updated_at: string;
}

interface BudgetCategoryRow {
  id: string;
  budget_id: string;
  category_id: string;
  limit_minor: number;
  created_at: string;
  updated_at: string;
}

function mapBudgetRow(row: BudgetRow): Budget {
  return {
    id: row.id,
    name: row.name,
    period: row.period,
    month: row.month,
    totalLimitMinor: row.total_limit_minor,
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBudgetCategoryRow(row: BudgetCategoryRow): BudgetCategory {
  return {
    id: row.id,
    budgetId: row.budget_id,
    categoryId: row.category_id,
    limitMinor: row.limit_minor,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getBudgetForMonth(month: string): Promise<Budget | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<BudgetRow>('SELECT * FROM budgets WHERE month = ? AND deleted_at IS NULL', month);
  return row ? mapBudgetRow(row) : null;
}

export async function listBudgetCategories(budgetId: string): Promise<BudgetCategory[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<BudgetCategoryRow>(
    'SELECT * FROM budget_categories WHERE budget_id = ? AND deleted_at IS NULL',
    budgetId,
  );
  return rows.map(mapBudgetCategoryRow);
}

export interface CreateBudgetInput {
  name: string;
  month: string;
  totalLimitMinor?: number | null;
  currency: CurrencyCode;
  categories: { categoryId: string; limitMinor: number }[];
}

export async function createBudget(input: CreateBudgetInput): Promise<Budget> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO budgets (id, name, period, month, total_limit_minor, currency, created_at, updated_at)
     VALUES (?, ?, 'monthly', ?, ?, ?, ?, ?)`,
    id,
    input.name,
    input.month,
    input.totalLimitMinor ?? null,
    input.currency,
    now,
    now,
  );

  for (const category of input.categories) {
    await db.runAsync(
      `INSERT INTO budget_categories (id, budget_id, category_id, limit_minor, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      Crypto.randomUUID(),
      id,
      category.categoryId,
      category.limitMinor,
      now,
      now,
    );
  }

  const budget = await getBudgetForMonth(input.month);
  if (!budget) throw new Error('Failed to create budget');
  return budget;
}

export async function updateBudgetCategoryLimit(budgetCategoryId: string, limitMinor: number): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE budget_categories SET limit_minor = ?, updated_at = ?, version = version + 1 WHERE id = ?',
    limitMinor,
    now,
    budgetCategoryId,
  );
}
