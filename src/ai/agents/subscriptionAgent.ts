import { formatMoney } from '@/utils/currency';
import { buildAgentResponse, type AgentDefinition } from './types';
import { t } from '@/i18n';

/** getBills adds recurring bills (rent, utilities) and due dates for the model path; the offline answer uses getSubscriptions only. */
export const SUBSCRIPTION_AGENT_TOOLS = ['getSubscriptions', 'getBills'];

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
  description: 'Reports subscriptions and recurring bills: what they cost per month and what is due next.',
  supportedIntents: ['subscriptions'],
  allowedTools: SUBSCRIPTION_AGENT_TOOLS,

  async execute(_request, context, tools) {
    const result = (await tools.execute('getSubscriptions', {})) as SubscriptionCostResult;

    if (result.items.length === 0) {
      return buildAgentResponse({ claims: [{ kind: 'fact', text: t('ag.subs.none') }] });
    }

    const lines = result.items.slice(0, 5).map((s) => `  - ${t('ag.subs.line', { name: s.name, amount: formatMoney(s.monthlyEquivalentMinor, context.currency) })}`);

    return buildAgentResponse({
      claims: [{ kind: 'fact', text: t('ag.subs.total', { amount: formatMoney(result.monthlyTotalMinor, context.currency), lines: lines.join('\n') }) }],
      metadata: { monthlyTotalMinor: result.monthlyTotalMinor },
    });
  },
};
