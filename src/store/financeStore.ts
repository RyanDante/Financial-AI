import { create } from 'zustand';
import { accountsRepository, categoriesRepository, goalsRepository, transactionsRepository } from '@/database/repositories';
import { calculateBalance, calculateMonthlySpending, calculateSavingsRate } from '@/finance/calculations';
import { getReserveTargetMinor, getUpcomingObligationsMinor } from '@/finance/aggregates';
import { DEFAULT_CURRENCY } from '@/constants/currencies';
import { currentMonthKey } from '@/utils/months';
import type { CreateAccountInput } from '@/database/repositories/accountsRepository';
import type { Account, Category, Goal, NewTransaction, Transaction } from '@/types/finance';

interface FinanceState {
  isLoading: boolean;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  goals: Goal[];
  totalBalanceMinor: number;
  monthlySpendingMinor: number;
  monthlyIncomeMinor: number;
  savingsRate: number;
  upcomingObligationsMinor: number;
  reserveTargetMinor: number;
  loadAll: () => Promise<void>;
  addTransaction: (input: NewTransaction) => Promise<void>;
  updateTransaction: (id: string, patch: Partial<NewTransaction>) => Promise<void>;
  /** Soft delete: sync pushes it to the cloud as a delete. */
  deleteTransaction: (id: string) => Promise<void>;
  /** Returns the updated goal, so callers can react to it reaching `completed`. */
  addGoalContribution: (goalId: string, amountMinor: number, note?: string | null) => Promise<Goal>;
  createAccount: (input: CreateAccountInput) => Promise<void>;
  updateAccount: (id: string, patch: Partial<CreateAccountInput & { isArchived: boolean }>) => Promise<void>;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  isLoading: true,
  accounts: [],
  categories: [],
  transactions: [],
  goals: [],
  totalBalanceMinor: 0,
  monthlySpendingMinor: 0,
  monthlyIncomeMinor: 0,
  savingsRate: 0,
  upcomingObligationsMinor: 0,
  reserveTargetMinor: 0,

  loadAll: async () => {
    set({ isLoading: true });

    const [accounts, categories, transactions, goals, upcomingObligationsMinor, reserveTargetMinor] = await Promise.all([
      accountsRepository.listAccounts(),
      categoriesRepository.listCategories(),
      transactionsRepository.listTransactions({ limit: 200 }),
      goalsRepository.listGoals(),
      getUpcomingObligationsMinor(DEFAULT_CURRENCY),
      getReserveTargetMinor(DEFAULT_CURRENCY),
    ]);

    const totalBalanceMinor = accounts
      .filter((a) => a.currency === DEFAULT_CURRENCY)
      .reduce((sum, account) => sum + calculateBalance(account, transactions), 0);

    const month = currentMonthKey();
    const monthlySpendingMinor = calculateMonthlySpending(transactions, month);
    const monthlyIncomeMinor = transactions
      .filter((tx) => tx.type === 'income' && tx.occurredAt.slice(0, 7) === month)
      .reduce((sum, tx) => sum + tx.amountMinor, 0);

    set({
      isLoading: false,
      accounts,
      categories,
      transactions,
      goals,
      totalBalanceMinor,
      monthlySpendingMinor,
      monthlyIncomeMinor,
      savingsRate: calculateSavingsRate(monthlyIncomeMinor, monthlySpendingMinor),
      upcomingObligationsMinor,
      reserveTargetMinor,
    });
  },

  addTransaction: async (input: NewTransaction) => {
    await transactionsRepository.createTransaction(input);
    await get().loadAll();
  },

  updateTransaction: async (id, patch) => {
    await transactionsRepository.updateTransaction(id, patch);
    await get().loadAll();
  },

  deleteTransaction: async (id) => {
    await transactionsRepository.deleteTransaction(id);
    await get().loadAll();
  },

  addGoalContribution: async (goalId, amountMinor, note) => {
    const goal = await goalsRepository.addGoalContribution(goalId, amountMinor, note);
    await get().loadAll();
    return goal;
  },

  createAccount: async (input) => {
    await accountsRepository.createAccount(input);
    await get().loadAll();
  },

  updateAccount: async (id, patch) => {
    await accountsRepository.updateAccount(id, patch);
    await get().loadAll();
  },
}));
