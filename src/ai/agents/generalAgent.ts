import { formatMoney } from '@/utils/currency';
import { buildAgentResponse, type AgentDefinition } from './types';
import { t } from '@/i18n';

/** Broad, read-only view of the user's finances for questions no specialist owns ("How am I doing?", "What should I watch out for?"). */
export const GENERAL_AGENT_TOOLS = [
  'getAccountsWithBalances',
  'getBalance',
  'getSpending',
  'getSpendingByCategory',
  'calculateCashFlow',
  'getBudgetStatus',
  'getGoals',
  'getBills',
  'getUpcomingObligations',
  'getAlerts',
  'getRecommendations',
  'getDebts',
  'getIncomeAndAllowance',
];

interface BalanceResult {
  totalBalanceMinor: number;
}

interface CashFlowResult {
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
}

/**
 * The overview specialist. With a real model it can combine any of the
 * read-only tools above; offline, it answers with the month at a glance:
 * total balance and this month's income, spending and net.
 */
export const generalAgent: AgentDefinition = {
  id: 'general',
  name: 'Finance Overview Agent',
  description: "Answers broad questions about the user's overall financial picture: balances, this month's cash flow, budgets, goals, bills, debts, payday and daily allowance, and anything that needs attention.",
  supportedIntents: ['general_finance'],
  allowedTools: GENERAL_AGENT_TOOLS,

  async execute(_request, context, tools) {
    const [balance, cashFlow] = await Promise.all([
      tools.execute('getBalance', {}) as Promise<BalanceResult>,
      tools.execute('calculateCashFlow', {}) as Promise<CashFlowResult>,
    ]);

    return buildAgentResponse({
      claims: [
        { kind: 'fact', text: t('ag.general.balance', { amount: formatMoney(balance.totalBalanceMinor, context.currency) }) },
        {
          kind: 'fact',
          text: t('ag.general.month', { income: formatMoney(cashFlow.incomeMinor, context.currency), spent: formatMoney(cashFlow.expenseMinor, context.currency) }),
        },
        {
          kind: 'calculation',
          text: t('ag.general.net', { net: formatMoney(cashFlow.netMinor, context.currency, { forceSign: true }) }),
        },
      ],
      followUpSuggestions: [t('ag.general.followUp1'), t('ag.general.followUp2')],
    });
  },
};
