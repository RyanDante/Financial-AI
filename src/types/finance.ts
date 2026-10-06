import type { CurrencyCode } from '@/constants/currencies';
import type { MinorUnits } from '@/utils/currency';

export type AccountType = 'cash' | 'checking' | 'savings' | 'mobile_money' | 'credit' | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  initialBalanceMinor: MinorUnits;
  color: string | null;
  icon: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CategoryType = 'income' | 'expense';

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: CategoryType;
  isDefault: boolean;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionSource = 'manual' | 'import' | 'ai';

export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  transferAccountId: string | null;
  amountMinor: MinorUnits;
  currency: CurrencyCode;
  type: TransactionType;
  merchant: string | null;
  description: string | null;
  notes: string | null;
  occurredAt: string;
  source: TransactionSource;
  createdAt: string;
  updatedAt: string;
}

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;

export interface Budget {
  id: string;
  name: string;
  period: 'monthly';
  /** "YYYY-MM" */
  month: string;
  totalLimitMinor: MinorUnits | null;
  currency: CurrencyCode;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetCategory {
  id: string;
  budgetId: string;
  categoryId: string;
  limitMinor: MinorUnits;
  createdAt: string;
  updatedAt: string;
}

export type GoalStatus = 'active' | 'completed' | 'archived';

export interface Goal {
  id: string;
  name: string;
  targetAmountMinor: MinorUnits;
  currentAmountMinor: MinorUnits;
  currency: CurrencyCode;
  deadline: string | null;
  icon: string | null;
  color: string | null;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  amountMinor: MinorUnits;
  note: string | null;
  contributedAt: string;
  createdAt: string;
}

export type RecurrenceFrequency = 'one_time' | 'weekly' | 'monthly' | 'yearly';

export interface IncomeSource {
  id: string;
  accountId: string | null;
  source: string;
  amountMinor: MinorUnits;
  currency: CurrencyCode;
  frequency: RecurrenceFrequency;
  nextExpectedAt: string | null;
  isActive: boolean;
}

/** `i_owe`: money the user owes (a loan, credit). `owed_to_me`: money the user lent someone. */
export type DebtDirection = 'i_owe' | 'owed_to_me';

export interface Debt {
  id: string;
  name: string;
  direction: DebtDirection;
  /** Who the money is owed to or by (a person, a bank); null for older debts. */
  counterparty: string | null;
  principalMinor: MinorUnits;
  remainingMinor: MinorUnits;
  currency: CurrencyCode;
  interestRate: number;
  minimumPaymentMinor: MinorUnits;
  dueDayOfMonth: number | null;
}

export interface RecurringExpense {
  id: string;
  name: string;
  categoryId: string | null;
  amountMinor: MinorUnits;
  currency: CurrencyCode;
  frequency: RecurrenceFrequency;
  nextDueAt: string | null;
  isActive: boolean;
}

export interface Subscription {
  id: string;
  name: string;
  categoryId: string | null;
  amountMinor: MinorUnits;
  currency: CurrencyCode;
  billingCycle: 'monthly' | 'yearly';
  nextBillingAt: string | null;
  isActive: boolean;
}

export interface FinancialSnapshot {
  id: string;
  snapshotDate: string;
  balanceMinor: MinorUnits;
  currency: CurrencyCode;
  totalIncomeMinor: MinorUnits;
  totalSpendingMinor: MinorUnits;
}
