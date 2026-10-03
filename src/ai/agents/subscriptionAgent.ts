import { formatMoney } from '@/utils/currency';
import { buildAgentResponse, type AgentDefinition } from './types';

export const SUBSCRIPTION_AGENT_TOOLS = ['getSubscriptions'];

interface SubscriptionCostResult {
  monthlyTotalMinor: number;
  items: { name: string; monthlyEquivalentMinor: number }[];
}

/**
 * Read-only. Reports subscription costs via getSubscriptions, which
 * already ranks them by monthly cost (calculateSubscriptionCost in the
 * financial engine did that). Ported from the pre-agent MockAIProvider
 * subscription branch.
 */
export const subscriptionAgent: AgentDefinition = {
  id: 'subscriptions',
  name: 'Subscription Agent',
  description: 'Reports active subscriptions and their monthly cost, ranked highest first.',
  supportedIntents: ['subscriptions'],
  allowedTools: SUBSCRIPTION_AGENT_TOOLS,

  async execute(_request, context, tools) {
    const result = (await tools.execute('getSubscriptions', {})) as SubscriptionCostResult;

    if (result.items.length === 0) {
      return buildAgentResponse({ claims: [{ kind: 'fact', text: 'No active subscriptions are tracked yet.' }] });
    }

    const lines = result.items.slice(0, 5).map((s) => `  - ${s.name}: ${formatMoney(s.monthlyEquivalentMinor, context.currency)}/mo`);

    return buildAgentResponse({
      claims: [{ kind: 'fact', text: `You're spending ${formatMoney(result.monthlyTotalMinor, context.currency)}/month on subscriptions:\n${lines.join('\n')}` }],
      metadata: { monthlyTotalMinor: result.monthlyTotalMinor },
    });
  },
};
