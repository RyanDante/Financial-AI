import type { LLMClient } from '@/ai/llm/types';
import type { AgentIntent } from './types';

const ROUTE_TOOL = 'choose_agent';

/**
 * Picks a specialist when the fast regex classifier can't (`unknown`). The
 * model can only answer with one of the intents passed in (a closed enum)
 * or "unknown"; anything else, or any failure, counts as "unknown". It is
 * a single cheap call with no data tools, so no user data leaves the
 * device at this step beyond the question itself.
 */
export async function routeWithLLM(
  client: LLMClient,
  text: string,
  intents: { intent: AgentIntent; description: string }[],
  signal?: AbortSignal,
): Promise<AgentIntent> {
  const allowed = intents.map((i) => i.intent);
  try {
    const response = await client.complete({
      system: [
        'You route questions in a personal finance app to the right specialist.',
        `Call ${ROUTE_TOOL} exactly once. Choose "unknown" if the message is not about the user's own money, accounts, spending, budgets, goals, bills, debts or plans.`,
        'Specialists:',
        ...intents.map((i) => `- ${i.intent}: ${i.description}`),
      ].join('\n'),
      turns: [{ role: 'user', text }],
      tools: [
        {
          name: ROUTE_TOOL,
          description: 'Choose the specialist that should answer.',
          parameters: {
            type: 'object',
            properties: { intent: { type: 'string', enum: [...allowed, 'unknown'] } },
            required: ['intent'],
            additionalProperties: false,
          },
        },
      ],
      maxTokens: 1024,
      signal,
    });
    const choice = response.toolCalls.find((c) => c.name === ROUTE_TOOL)?.input.intent;
    return typeof choice === 'string' && (allowed as string[]).includes(choice) ? (choice as AgentIntent) : 'unknown';
  } catch {
    return 'unknown';
  }
}
