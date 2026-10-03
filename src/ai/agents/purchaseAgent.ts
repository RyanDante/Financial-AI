import { formatMoney, majorToMinor } from '@/utils/currency';
import type { PurchaseImpactResult } from '@/finance/calculations';
import { buildAgentResponse, type AgentClaim, type AgentDefinition } from './types';

export const PURCHASE_AGENT_TOOLS = ['calculatePurchaseImpact'];

/**
 * Read-only. Reports the structured facts of a prospective purchase via
 * calculatePurchaseImpact — balance, reserve, and goal impact — and never
 * tells the user whether they "should" buy it (calculatePurchaseImpact
 * itself is deliberately verdict-free; see docs/ARCHITECTURE.md "AI
 * safety / financial design principle"). Ported from the pre-agent
 * MockAIProvider purchase branch so this capability isn't lost by moving
 * behind the Orchestrator.
 */
export const purchaseAgent: AgentDefinition = {
  id: 'purchase',
  name: 'Purchase Agent',
  description: 'Reports the balance/reserve/goal impact of a prospective purchase — facts only, never a recommendation.',
  supportedIntents: ['purchase'],
  allowedTools: PURCHASE_AGENT_TOOLS,

  async execute(request, context, tools) {
    const amountMajor = request.entities.amountMajor as number | undefined;
    if (amountMajor === undefined) {
      return buildAgentResponse({
        claims: [{ kind: 'ai_interpretation', text: "I didn't catch an amount — how much are you thinking of spending?" }],
      });
    }

    const purchaseAmountMinor = majorToMinor(amountMajor, context.currency);
    const result = (await tools.execute('calculatePurchaseImpact', {
      purchaseAmountMinor,
      currency: context.currency,
    })) as PurchaseImpactResult;

    const claims: AgentClaim[] = [
      { kind: 'fact', text: `Your current balance is ${formatMoney(result.currentBalanceMinor, context.currency)}.` },
      {
        kind: 'calculation',
        text: `After this ${formatMoney(result.purchaseAmountMinor, context.currency)} purchase, your projected balance would be ${formatMoney(result.projectedBalanceMinor, context.currency)}.`,
      },
    ];

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

    const maxDelay = result.goalImpacts.length > 0 ? Math.max(...result.goalImpacts.map((g) => g.delayMonths ?? 0)) : 0;
    if (maxDelay > 0) {
      claims.push({
        kind: 'assumption',
        text: `If this came out of your goal contributions instead, it could delay them by roughly ${maxDelay.toFixed(1)} month(s).`,
      });
    }

    return buildAgentResponse({ claims, metadata: { purchaseAmountMinor } });
  },
};
