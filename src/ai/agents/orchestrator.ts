import { buildAgentResponse, type AgentContext, type AgentResponse } from './types';
import { classifyIntent, extractAmountMajor, extractMonthsCount } from './intentClassifier';
import { createScopedTools, type ToolExecutor } from './toolAccess';
import type { AgentRegistry } from './registry';

/**
 * The central routing layer. The Orchestrator classifies intent and hands
 * the request to the matching specialist — it never calls a financial
 * tool itself and never computes anything. See docs/AI_ARCHITECTURE.md
 * "Future agent architecture".
 */
export class Orchestrator {
  constructor(private registry: AgentRegistry) {}

  async handle(text: string, context: AgentContext, tools: ToolExecutor): Promise<AgentResponse> {
    const intent = classifyIntent(text);

    if (intent === 'unknown') {
      return this.unknownIntentResponse();
    }

    const agent = this.registry.findByIntent(intent);
    if (!agent) {
      return this.unavailableSpecialistResponse(intent);
    }

    const scopedTools = createScopedTools(tools, agent.allowedTools);

    const entities: Record<string, unknown> = {};
    const amountMajor = extractAmountMajor(text);
    if (amountMajor !== null) entities.amountMajor = amountMajor;
    const monthsCount = extractMonthsCount(text);
    if (monthsCount !== null) entities.monthsCount = monthsCount;

    try {
      const response = await agent.execute({ text, intent, entities }, context, scopedTools);
      // An agent has no way to read back the calls it made through the
      // scoped wrapper (it only ever sees `execute`), so the Orchestrator
      // — which does hold the wrapper — is what actually populates
      // toolResults on the final response.
      return { ...response, toolResults: scopedTools.getCalls() };
    } catch (error) {
      return this.agentFailureResponse(agent.name, error);
    }
  }

  private unknownIntentResponse(): AgentResponse {
    return buildAgentResponse({
      claims: [
        {
          kind: 'ai_interpretation',
          text:
            "I'm not sure what you're asking. I can help with spending, budgets, goals, forecasts, purchases, or subscriptions — try something like \"How much did I spend this month?\" or \"Can I afford a 100,000 XAF purchase?\"",
        },
      ],
    });
  }

  private unavailableSpecialistResponse(intent: string): AgentResponse {
    return buildAgentResponse({
      claims: [{ kind: 'ai_interpretation', text: `I understood that as a "${intent}" question, but I don't have a specialist for it yet.` }],
      warnings: [`No agent is registered for intent "${intent}".`],
    });
  }

  private agentFailureResponse(agentName: string, error: unknown): AgentResponse {
    const message = error instanceof Error ? error.message : String(error);
    return buildAgentResponse({
      claims: [{ kind: 'ai_interpretation', text: `${agentName} couldn't complete that — ${message}` }],
      warnings: [`${agentName} failed: ${message}`],
    });
  }
}
