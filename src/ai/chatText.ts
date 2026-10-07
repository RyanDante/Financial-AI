/** What the copilot is doing, shown under the typing indicator while a tool runs. */
const TOOL_STEPS: Record<string, string> = {
  getBalance: 'Reading your balances…',
  getAccounts: 'Reading your accounts…',
  getAccountsWithBalances: 'Reading your accounts…',
  getTransactions: 'Looking through your transactions…',
  getSpending: "Adding up this month's spending…",
  getSpendingByCategory: 'Grouping your spending by category…',
  calculateCashFlow: 'Working out money in and out…',
  getBudget: 'Checking your budget…',
  getBudgetStatus: 'Checking your budget…',
  getGoals: 'Reading your goals…',
  getGoalProgress: 'Checking your goal progress…',
  calculateGoalProjection: 'Projecting your goal…',
  getSubscriptions: 'Reading your subscriptions…',
  getBills: 'Checking your bills…',
  getUpcomingObligations: 'Adding up upcoming bills…',
  calculatePurchaseImpact: 'Working out what this purchase would change…',
  forecastBalance: 'Projecting your balance…',
  getRecommendations: 'Looking for suggestions…',
  getAlerts: 'Checking what needs attention…',
  getDebts: 'Reading your debts…',
  getIncomeAndAllowance: 'Checking your income and payday…',
};

export function describeToolStep(toolName: string): string {
  return TOOL_STEPS[toolName] ?? 'Checking your data…';
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
