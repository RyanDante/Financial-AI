import { formatMoney, majorToMinor } from '@/utils/currency';
import type { PurchaseImpactResult } from '@/finance/calculations';
import { currentMonthKey } from './dateEntities';
import { buildAgentResponse, type AgentClaim, type AgentDefinition } from './types';

export const PURCHASE_AGENT_TOOLS = ['calculatePurchaseImpact', 'getBudgetStatus', 'calculateCashFlow'];

interface BudgetCategoryStatus {
  categoryId: string;
  categoryName: string;
  limitMinor: number;
  spentMinor: number;
}

interface BudgetStatusResult {
  month: string;
  budget: { id: string; name: string; currency: string } | null;
  categories: BudgetCategoryStatus[];
}

interface CashFlowResult {
  month: string;
  currency: string;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
}

/**
 * Read-only. Reports the structured facts of a prospective purchase —
 * balance, upcoming obligations, this month's budget, cash flow, and goal
 * impact — and never tells the user whether they "should" buy it
 * (calculatePurchaseImpact itself is deliberately verdict-free; see
 * docs/AI_ARCHITECTURE.md "AI safety / financial design principle"). Only
 * calculatePurchaseImpact's numbers are treated as authoritative for
 * balance/reserve/goal math; getBudgetStatus/calculateCashFlow add
 * context the purchase-impact calculation doesn't cover, combined here
 * with plain arithmetic (not new financial logic).
 */
export const purchaseAgent: AgentDefinition = {
  id: 'purchase',
  name: 'Purchase Agent',
  description: 'Reports the balance/budget/cash-flow/goal impact of a prospective purchase — facts only, never a recommendation.',
  supportedIntents: ['purchase'],
  allowedTools: PURCHASE_AGENT_TOOLS,

  async execute(request, context, tools) {
    const amountMajor = request.entities.amountMajor as number | undefined;
    if (amountMajor === undefined || Number.isNaN(amountMajor) || amountMajor <= 0) {
      return buildAgentResponse({
        claims: [{ kind: 'ai_interpretation', text: "I didn't catch an amount — how much are you thinking of spending?" }],
      });
    }

    const purchaseAmountMinor = majorToMinor(amountMajor, context.currency);
    const [result, budgetStatus, cashFlow] = await Promise.all([
      tools.execute('calculatePurchaseImpact', { purchaseAmountMinor, currency: context.currency }) as Promise<PurchaseImpactResult | null | undefined>,
      tools.execute('getBudgetStatus', { month: currentMonthKey() }) as Promise<BudgetStatusResult | null | undefined>,
      tools.execute('calculateCashFlow', { currency: context.currency }) as Promise<CashFlowResult | null | undefined>,
    ]);

    if (!result) {
      return buildAgentResponse({
        claims: [{ kind: 'ai_interpretation', text: "I don't have enough account data yet to evaluate this purchase." }],
      });
    }

    const claims: AgentClaim[] = [
      { kind: 'fact', text: `Your current balance is ${formatMoney(result.currentBalanceMinor, context.currency)}.` },
      {
        kind: 'calculation',
        text: `After this ${formatMoney(result.purchaseAmountMinor, context.currency)} purchase, your projected balance would be ${formatMoney(result.projectedBalanceMinor, context.currency)}.`,
      },
      { kind: 'fact', text: `You have ${formatMoney(result.upcomingObligationsMinor, context.currency)} in upcoming obligations (recurring expenses and subscriptions) this month.` },
    ];

    if (!result.canCoverObligationsAfterPurchase) {
      claims.push({ kind: 'projection', text: "This purchase would leave your balance unable to fully cover those upcoming obligations on its own." });
    }

    if (result.isReserveIntactAfterPurchase) {
      claims.push({
        kind: 'fact',
        text: `Your emergency reserve target of ${formatMoney(result.reserveTargetMinor, context.currency)} would remain intact.`,
      });
    } else {
      claims.push({
        kind: 'projection',
        text: `This would leave you ${formatMoney(result.shortfallMinor, context.currency)} short of your reserve target and upcoming obligations.`,
      });
    }

    if (cashFlow) {
      claims.push({
        kind: 'fact',
        text: `This month you've taken in ${formatMoney(cashFlow.incomeMinor, context.currency)} and spent ${formatMoney(cashFlow.expenseMinor, context.currency)}, a net cash flow of ${formatMoney(cashFlow.netMinor, context.currency)}.`,
      });
    }

    const budgetCategories = budgetStatus?.categories ?? [];
    if (budgetStatus?.budget && budgetCategories.length > 0) {
      const totalLimitMinor = budgetCategories.reduce((sum, c) => sum + c.limitMinor, 0);
      const totalSpentMinor = budgetCategories.reduce((sum, c) => sum + c.spentMinor, 0);
      const remainingAfterPurchaseMinor = totalLimitMinor - totalSpentMinor - purchaseAmountMinor;
      claims.push({
        kind: 'calculation',
        text:
          remainingAfterPurchaseMinor >= 0
            ? `Counted against this month's budget, you'd still have ${formatMoney(remainingAfterPurchaseMinor, context.currency)} left.`
            : `Counted against this month's budget, this would put you ${formatMoney(Math.abs(remainingAfterPurchaseMinor), context.currency)} over.`,
      });
    }

    const goalImpacts = result.goalImpacts ?? [];
    const maxDelay = goalImpacts.length > 0 ? Math.max(...goalImpacts.map((g) => g.delayMonths ?? 0)) : 0;
    if (maxDelay > 0) {
      claims.push({
        kind: 'assumption',
        text: `If this came out of your goal contributions instead, it could delay them by roughly ${maxDelay.toFixed(1)} month(s).`,
      });
    }

    return buildAgentResponse({ claims, metadata: { purchaseAmountMinor } });
  },
};
