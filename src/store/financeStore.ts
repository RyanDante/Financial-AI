import { create } from 'zustand';
import { accountsRepository, categoriesRepository, goalsRepository, transactionsRepository } from '@/database/repositories';
import { calculateBalance, calculateMonthlySpending, calculateSavingsRate } from '@/finance/calculations';
import { getReserveTargetMinor, getUpcomingObligationsMinor } from '@/finance/aggregates';
import { DEFAULT_CURRENCY } from '@/constants/currencies';
import type { Account, Category, Goal, NewTransaction, Transaction } from '@/types/finance';

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

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
}));
