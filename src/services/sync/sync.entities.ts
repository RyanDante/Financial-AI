import type { SyncEntityConfig } from './sync.types';

/**
 * Every entity the sync engine actually moves between SQLite and
 * Firestore today. `ai_conversations` / `ai_messages` are deliberately NOT
 * here yet — their Firestore paths are documented in docs/FIREBASE.md and
 * the nested users/{uid}/aiConversations/{id}/messages/{id} shape doesn't
 * fit this engine's flat-collection assumption, so wiring them up is left
 * as documented future work rather than special-cased here (see
 * docs/FIREBASE.md "What isn't synced yet").
 */
export const SYNC_ENTITIES: SyncEntityConfig[] = [
  {
    tableName: 'accounts',
    collectionName: 'accounts',
    columns: ['name', 'type', 'currency', 'initial_balance_minor', 'color', 'icon', 'is_archived'],
    timestampColumn: 'updated_at',
    supportsSoftDelete: true,
  },
  {
    tableName: 'categories',
    collectionName: 'categories',
    columns: ['name', 'icon', 'color', 'type', 'is_default', 'parent_id'],
    timestampColumn: 'updated_at',
    supportsSoftDelete: true,
  },
  {
    tableName: 'transactions',
    collectionName: 'transactions',
    columns: [
      'account_id',
      'category_id',
      'transfer_account_id',
      'amount_minor',
      'currency',
      'type',
      'merchant',
      'description',
      'notes',
      'occurred_at',
      'source',
    ],
    timestampColumn: 'updated_at',
    supportsSoftDelete: true,
  },
  {
    tableName: 'budgets',
    collectionName: 'budgets',
    columns: ['name', 'period', 'month', 'total_limit_minor', 'currency'],
    timestampColumn: 'updated_at',
    supportsSoftDelete: true,
  },
  {
    tableName: 'budget_categories',
    collectionName: 'budgetCategories',
    columns: ['budget_id', 'category_id', 'limit_minor'],
    timestampColumn: 'updated_at',
    supportsSoftDelete: true,
  },
  {
    tableName: 'goals',
    collectionName: 'goals',
    columns: ['name', 'target_amount_minor', 'current_amount_minor', 'currency', 'deadline', 'icon', 'color', 'status'],
    timestampColumn: 'updated_at',
    supportsSoftDelete: true,
  },
  {
    tableName: 'goal_contributions',
    collectionName: 'goalContributions',
    columns: ['goal_id', 'amount_minor', 'note', 'contributed_at'],
    timestampColumn: 'updated_at',
    supportsSoftDelete: true,
  },
  {
    tableName: 'income',
    collectionName: 'income',
    columns: ['account_id', 'source', 'amount_minor', 'currency', 'frequency', 'next_expected_at', 'is_active'],
    timestampColumn: 'updated_at',
    supportsSoftDelete: true,
  },
  {
    tableName: 'debts',
    collectionName: 'debts',
    columns: ['name', 'direction', 'counterparty', 'principal_minor', 'remaining_minor', 'currency', 'interest_rate', 'minimum_payment_minor', 'due_day_of_month'],
    timestampColumn: 'updated_at',
    supportsSoftDelete: true,
  },
  {
    tableName: 'recurring_expenses',
    collectionName: 'recurringExpenses',
    columns: ['name', 'category_id', 'amount_minor', 'currency', 'frequency', 'next_due_at', 'is_active'],
    timestampColumn: 'updated_at',
    supportsSoftDelete: true,
  },
  {
    tableName: 'subscriptions',
    collectionName: 'subscriptions',
    columns: ['name', 'category_id', 'amount_minor', 'currency', 'billing_cycle', 'next_billing_at', 'is_active'],
    timestampColumn: 'updated_at',
    supportsSoftDelete: true,
  },
  {
    tableName: 'financial_snapshots',
    collectionName: 'financialSnapshots',
    columns: ['snapshot_date', 'balance_minor', 'currency', 'total_income_minor', 'total_spending_minor', 'metadata_json'],
    // Snapshots are immutable/append-only — created_at is the only timestamp that exists, and that's fine, since nothing ever updates one.
    timestampColumn: 'created_at',
    supportsSoftDelete: false,
  },
  {
    tableName: 'ai_memory',
    collectionName: 'aiMemory',
    columns: ['key', 'value'],
    timestampColumn: 'updated_at',
    supportsSoftDelete: false,
  },
];

export function getSyncEntity(tableName: string): SyncEntityConfig {
  const entity = SYNC_ENTITIES.find((e) => e.tableName === tableName);
  if (!entity) throw new Error(`No sync entity registered for table "${tableName}"`);
  return entity;
}
