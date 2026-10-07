import { t, type MessageKey } from '@/i18n';

/** Tools that share a step description with another tool. */
const STEP_ALIASES: Record<string, string> = {
  getAccountsWithBalances: 'getAccounts',
  getBudgetStatus: 'getBudget',
};

const STEP_TOOLS = new Set([
  'getBalance',
  'getAccounts',
  'getTransactions',
  'getSpending',
  'getSpendingByCategory',
  'calculateCashFlow',
  'getBudget',
  'getGoals',
  'getGoalProgress',
  'calculateGoalProjection',
  'getSubscriptions',
  'getBills',
  'getUpcomingObligations',
  'calculatePurchaseImpact',
  'forecastBalance',
  'getRecommendations',
  'getAlerts',
  'getDebts',
  'getIncomeAndAllowance',
]);

/** What the copilot is doing, shown under the typing indicator while a tool runs. */
export function describeToolStep(toolName: string): string {
  const name = STEP_ALIASES[toolName] ?? toolName;
  return t(STEP_TOOLS.has(name) ? (`step.${name}` as MessageKey) : 'step.default');
}

const TITLE_MAX = 40;

/** A conversation's title: its first question, cut at a word boundary. */
export function conversationTitle(firstQuestion: string): string {
  const oneLine = firstQuestion.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= TITLE_MAX) return oneLine;
  const cut = oneLine.slice(0, TITLE_MAX);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
