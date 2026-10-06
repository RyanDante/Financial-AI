import type { LLMClient, LLMToolSpec } from '@/ai/llm/types';
import { LLMError } from '@/ai/llm/types';
import { buildAgentResponse, type AgentContext, type AgentDefinition, type AgentIntent, type AgentResponse } from './types';
import { classifyIntent, extractAmountMajor, extractMonthsCount } from './intentClassifier';
import { createScopedTools, type ScopedToolExecutor, type ToolExecutor } from './toolAccess';
import { AgentFallback, runAgentWithLLM } from './llmRunner';
import { routeWithLLM } from './llmRouter';
import { guardClaims } from './numberGuard';
import type { AgentRegistry } from './registry';

export interface OrchestratorLLM {
  client: LLMClient;
  /** Model-facing specs for the tools in an agent's allowlist. */
  toolSpecs: (allowed: string[]) => LLMToolSpec[];
}

export interface HandleOptions {
  /** Earlier messages in this conversation, oldest first; used only by the model path. */
  history?: { role: 'user' | 'assistant'; text: string }[];
  signal?: AbortSignal;
}

const HISTORY_LIMIT = 10;

/**
 * The central routing layer. It classifies intent, picks the specialist,
 * and runs it — never calling a financial tool or computing anything
 * itself (docs/AI_ARCHITECTURE.md).
 *
 * With a model configured (`llm`), the specialist answers through
 * runAgentWithLLM, limited to its own tool allowlist, and the number guard
 * checks every figure against what the tools returned. Any model failure
 * (offline, timeout, refusal, a malformed answer, too many steps) falls
 * back to the agent's deterministic `execute`, so the copilot always answers.
 */
export class Orchestrator {
  constructor(
    private registry: AgentRegistry,
    private llm?: OrchestratorLLM,
  ) {}

  async handle(text: string, context: AgentContext, tools: ToolExecutor, options: HandleOptions = {}): Promise<AgentResponse> {
    let intent = classifyIntent(text);

    if (intent === 'unknown' && this.llm) {
      intent = await routeWithLLM(this.llm.client, text, this.routableIntents(), options.signal);
    }
    if (intent === 'unknown') {
      return this.unknownIntentResponse();
    }

    const agent = this.registry.findByIntent(intent);
    if (!agent) {
      return this.unavailableSpecialistResponse(intent);
    }

    if (this.llm) {
      const llmTools = createScopedTools(tools, agent.allowedTools);
      try {
        const result = await runAgentWithLLM({
          client: this.llm.client,
          agent,
          text,
          history: (options.history ?? []).slice(-HISTORY_LIMIT),
          tools: llmTools,
          toolSpecs: this.llm.toolSpecs(agent.allowedTools),
          context,
          signal: options.signal,
        });
        const toolResults = llmTools.getCalls();
        const guarded = guardClaims(result.claims, toolResults);
        return {
          ...buildAgentResponse({
            claims: guarded.claims,
            warnings: guarded.downgraded > 0 ? ["Some figures couldn't be matched to your data, so they're shown as interpretation, not fact."] : [],
            followUpSuggestions: result.followUps,
            metadata: { mode: 'llm', provider: this.llm.client.provider, model: this.llm.client.model, downgradedClaims: guarded.downgraded },
          }),
          toolResults,
          agentName: agent.name,
        };
      } catch (error) {
        if (!(error instanceof LLMError) && !(error instanceof AgentFallback)) {
          if (__DEV__) console.warn('[ai] model path failed unexpectedly', error);
        }
        // Fall through to the deterministic answer, noting why for the user.
        return this.runDeterministic(agent, intent, text, context, tools, offlineNote(error));
      }
    }

    return this.runDeterministic(agent, intent, text, context, tools, null);
  }

  private async runDeterministic(
    agent: AgentDefinition,
    intent: AgentIntent,
    text: string,
    context: AgentContext,
    tools: ToolExecutor,
    note: string | null,
  ): Promise<AgentResponse> {
    const scopedTools: ScopedToolExecutor = createScopedTools(tools, agent.allowedTools);

    const entities: Record<string, unknown> = {};
    const amountMajor = extractAmountMajor(text);
    if (amountMajor !== null) entities.amountMajor = amountMajor;
    const monthsCount = extractMonthsCount(text);
    if (monthsCount !== null) entities.monthsCount = monthsCount;

    try {
      const response = await agent.execute({ text, intent, entities }, context, scopedTools);
      // An agent can't read back the calls it made through the scoped
      // wrapper, so the Orchestrator attaches them (and the agent's name).
      const warnings = note ? [...response.warnings, note] : response.warnings;
      const message = note ? `${response.message}\n${note}` : response.message;
      return { ...response, message, warnings, toolResults: scopedTools.getCalls(), agentName: agent.name };
    } catch (error) {
      if (__DEV__) console.warn(`[ai] ${agent.name} failed`, error);
      return this.agentFailureResponse(agent.name);
    }
  }

  /** Intents that have a registered agent, for the model router's closed list. */
  private routableIntents(): { intent: AgentIntent; description: string }[] {
    return this.registry
      .list()
      .flatMap((agent) => agent.supportedIntents.map((intent) => ({ intent, description: agent.description })));
  }

  private unknownIntentResponse(): AgentResponse {
    return buildAgentResponse({
      claims: [
        {
          kind: 'ai_interpretation',
          text:
            "I'm not sure what you're asking. I can help with spending, budgets, goals, bills, forecasts or purchases. Try \"How much did I spend this month?\" or \"Can I afford a 100,000 XAF purchase?\"",
        },
      ],
    });
  }

  private unavailableSpecialistResponse(intent: string): AgentResponse {
    return buildAgentResponse({
      claims: [{ kind: 'ai_interpretation', text: `I understood that as a "${intent}" question, but I can't answer that kind of question yet.` }],
      warnings: [`No agent is registered for intent "${intent}".`],
    });
  }

  /** Never shows the raw error (it can contain SQL or stack details); that goes to the dev console only. */
  private agentFailureResponse(agentName: string): AgentResponse {
    return {
      ...buildAgentResponse({
        claims: [{ kind: 'ai_interpretation', text: "Something went wrong while reading your data, so I couldn't answer that. Please try again." }],
        warnings: [`${agentName} failed.`],
      }),
      agentName,
    };
  }
}

/** A short, user-facing line explaining why the offline answer was used. */
function offlineNote(error: unknown): string {
  if (error instanceof LLMError && !error.retryable) return `Answered offline: ${error.message}`;
  if (error instanceof AgentFallback && error.reason === 'refusal') return 'Answered offline: the AI model declined this question.';
  return 'Answered offline: the AI model was unavailable, so this is the built-in answer.';
}
