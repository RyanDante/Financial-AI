import * as Crypto from 'expo-crypto';
import { getDatabase } from '../client';
import type { Goal, GoalContribution, GoalStatus } from '@/types/finance';
import type { CurrencyCode } from '@/constants/currencies';

interface GoalRow {
  id: string;
  name: string;
  target_amount_minor: number;
  current_amount_minor: number;
  currency: CurrencyCode;
  deadline: string | null;
  icon: string | null;
  color: string | null;
  status: GoalStatus;
  created_at: string;
  updated_at: string;
}

interface GoalContributionRow {
  id: string;
  goal_id: string;
  amount_minor: number;
  note: string | null;
  contributed_at: string;
  created_at: string;
}

function mapGoalRow(row: GoalRow): Goal {
  return {
    id: row.id,
    name: row.name,
    targetAmountMinor: row.target_amount_minor,
    currentAmountMinor: row.current_amount_minor,
    currency: row.currency,
    deadline: row.deadline,
    icon: row.icon,
    color: row.color,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapContributionRow(row: GoalContributionRow): GoalContribution {
  return {
    id: row.id,
    goalId: row.goal_id,
    amountMinor: row.amount_minor,
    note: row.note,
    contributedAt: row.contributed_at,
    createdAt: row.created_at,
  };
}

export async function listGoals(status?: GoalStatus): Promise<Goal[]> {
  const db = await getDatabase();
  const rows = status
    ? await db.getAllAsync<GoalRow>('SELECT * FROM goals WHERE deleted_at IS NULL AND status = ? ORDER BY created_at ASC', status)
    : await db.getAllAsync<GoalRow>('SELECT * FROM goals WHERE deleted_at IS NULL ORDER BY created_at ASC');
  return rows.map(mapGoalRow);
}

export async function getGoalById(id: string): Promise<Goal | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<GoalRow>('SELECT * FROM goals WHERE id = ? AND deleted_at IS NULL', id);
  return row ? mapGoalRow(row) : null;
}

export async function listGoalContributions(goalId: string): Promise<GoalContribution[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<GoalContributionRow>(
    'SELECT * FROM goal_contributions WHERE goal_id = ? AND deleted_at IS NULL ORDER BY contributed_at ASC',
    goalId,
  );
  return rows.map(mapContributionRow);
}

export interface CreateGoalInput {
  name: string;
  targetAmountMinor: number;
  currentAmountMinor?: number;
  currency: CurrencyCode;
  deadline?: string | null;
  icon?: string | null;
  color?: string | null;
}

export async function createGoal(input: CreateGoalInput): Promise<Goal> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO goals (id, name, target_amount_minor, current_amount_minor, currency, deadline, icon, color, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    id,
    input.name,
    input.targetAmountMinor,
    input.currentAmountMinor ?? 0,
    input.currency,
    input.deadline ?? null,
    input.icon ?? null,
    input.color ?? null,
    now,
    now,
  );
  const goal = await getGoalById(id);
  if (!goal) throw new Error('Failed to create goal');
  return goal;
}

/** Records a contribution and atomically updates the goal's running total and status. */
export async function addGoalContribution(goalId: string, amountMinor: number, note?: string | null): Promise<Goal> {
  const db = await getDatabase();
  const goal = await getGoalById(goalId);
  if (!goal) throw new Error(`Goal ${goalId} not found`);
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO goal_contributions (id, goal_id, amount_minor, note, contributed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      Crypto.randomUUID(),
      goalId,
      amountMinor,
      note ?? null,
      now,
      now,
      now,
    );

    const newTotal = goal.currentAmountMinor + amountMinor;
    const newStatus: GoalStatus = newTotal >= goal.targetAmountMinor ? 'completed' : goal.status;

    await db.runAsync(
      `UPDATE goals SET current_amount_minor = ?, status = ?, updated_at = ?, version = version + 1 WHERE id = ?`,
      newTotal,
      newStatus,
      now,
      goalId,
    );
  });

  const updated = await getGoalById(goalId);
  if (!updated) throw new Error('Failed to update goal after contribution');
  return updated;
}
