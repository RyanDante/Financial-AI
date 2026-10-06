import { formatMoney } from '@/utils/currency';
import { buildAgentResponse, type AgentDefinition } from './types';

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
  description: "Answers broad questions about the user's overall financial picture: balances, this month's cash flow, budgets, goals, bills and anything that needs attention.",
  supportedIntents: ['general_finance'],
  allowedTools: GENERAL_AGENT_TOOLS,

  async execute(_request, context, tools) {
    const [balance, cashFlow] = await Promise.all([
      tools.execute('getBalance', {}) as Promise<BalanceResult>,
      tools.execute('calculateCashFlow', {}) as Promise<CashFlowResult>,
    ]);

    return buildAgentResponse({
      claims: [
        { kind: 'fact', text: `Your total balance is ${formatMoney(balance.totalBalanceMinor, context.currency)}.` },
        {
          kind: 'fact',
          text: `This month you've received ${formatMoney(cashFlow.incomeMinor, context.currency)} and spent ${formatMoney(cashFlow.expenseMinor, context.currency)}.`,
        },
        {
          kind: 'calculation',
          text: `That leaves a net of ${formatMoney(cashFlow.netMinor, context.currency, { forceSign: true })} for the month so far.`,
        },
      ],
      followUpSuggestions: ['Where is my money going?', 'Am I on track with my budget?'],
    });
  },
};
