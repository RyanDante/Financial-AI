/**
 * Initial schema. All monetary columns store integer minor units (see
 * src/utils/currency.ts) — never floats. Tables that are candidates for
 * future remote sync carry created_at/updated_at/deleted_at/version so a
 * sync layer can diff local vs. remote state without a schema change.
 */
export const MIGRATION_001_INITIAL = `
CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  default_currency TEXT NOT NULL DEFAULT 'XAF',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE accounts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'cash',
  currency TEXT NOT NULL DEFAULT 'XAF',
  initial_balance_minor INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  icon TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  type TEXT NOT NULL DEFAULT 'expense',
  is_default INTEGER NOT NULL DEFAULT 0,
  parent_id TEXT REFERENCES categories(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  category_id TEXT REFERENCES categories(id),
  transfer_account_id TEXT REFERENCES accounts(id),
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense',
  merchant TEXT,
  description TEXT,
  notes TEXT,
  occurred_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_occurred_at ON transactions(occurred_at);

CREATE TABLE budgets (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly',
  month TEXT NOT NULL,
  total_limit_minor INTEGER,
  currency TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_budgets_month ON budgets(month);

CREATE TABLE budget_categories (
  id TEXT PRIMARY KEY NOT NULL,
  budget_id TEXT NOT NULL REFERENCES budgets(id),
  category_id TEXT NOT NULL REFERENCES categories(id),
  limit_minor INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_budget_categories_budget ON budget_categories(budget_id);

CREATE TABLE goals (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  target_amount_minor INTEGER NOT NULL,
  current_amount_minor INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  deadline TEXT,
  icon TEXT,
  color TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE goal_contributions (
  id TEXT PRIMARY KEY NOT NULL,
  goal_id TEXT NOT NULL REFERENCES goals(id),
  amount_minor INTEGER NOT NULL,
  note TEXT,
  contributed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_goal_contributions_goal ON goal_contributions(goal_id);

CREATE TABLE income (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT REFERENCES accounts(id),
  source TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  next_expected_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE debts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  principal_minor INTEGER NOT NULL,
  remaining_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  interest_rate REAL NOT NULL DEFAULT 0,
  minimum_payment_minor INTEGER NOT NULL DEFAULT 0,
  due_day_of_month INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE recurring_expenses (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id),
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  next_due_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id),
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  next_billing_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE financial_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  snapshot_date TEXT NOT NULL,
  balance_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  total_income_minor INTEGER NOT NULL DEFAULT 0,
  total_spending_minor INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_financial_snapshots_date ON financial_snapshots(snapshot_date);

CREATE TABLE settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE ai_conversations (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE ai_messages (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES ai_conversations(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id);

CREATE TABLE ai_memory (
  id TEXT PRIMARY KEY NOT NULL,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  synced_at TEXT
);
CREATE INDEX idx_sync_queue_pending ON sync_queue(synced_at);

CREATE TABLE sync_metadata (
  table_name TEXT PRIMARY KEY NOT NULL,
  last_synced_at TEXT,
  last_pulled_at TEXT
);
`;
