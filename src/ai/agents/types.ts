import type { ClaimKind, ToolCallRecord } from '@/types/ai';
import type { CurrencyCode } from '@/constants/currencies';
import type { ToolExecutor } from './toolAccess';

/**
 * The intent taxonomy the Orchestrator classifies a user message into.
 * Deliberately a flat, closed set for now — "unknown" is a real outcome,
 * not an error, and the Orchestrator must handle it gracefully rather than
 * guessing (see docs/AI_ARCHITECTURE.md "Future agent architecture").
 */
export type AgentIntent =
  | 'spending'
  | 'budget'
  | 'goal'
  | 'forecast'
  | 'purchase'
  | 'subscriptions'
  | 'transactions'
  | 'general_finance'
  | 'unknown';

/** Parameters the Orchestrator extracted from the raw text — an agent reads these instead of re-parsing the message itself. */
export interface AgentRequest {
  text: string;
  intent: AgentIntent;
  entities: Record<string, unknown>;
}

export interface AgentContext {
  currency: CurrencyCode;
  conversationId?: string;
}

/** One claim the agent is making, tagged with the kind of claim it is — see docs/AI_ARCHITECTURE.md "Claim labeling". */
export interface AgentClaim {
  kind: ClaimKind;
  text: string;
}

/**
 * What every agent returns. `message` is a ready-to-render narration
 * built from `claims` (in FACT → CALCULATION → PROJECTION → ASSUMPTION →
 * AI_INTERPRETATION order) plus any warnings/follow-ups — callers that
 * want the raw pieces instead of the assembled string can read `claims`
 * directly. Nothing here is ever raw chain-of-thought.
 */
export interface AgentResponse {
  message: string;
  claims: AgentClaim[];
  warnings: string[];
  toolResults: ToolCallRecord[];
  followUpSuggestions: string[];
  metadata?: Record<string, unknown>;
  /**
   * Which agent produced this response — set by the Orchestrator after
   * `execute` returns (an agent has no reason to know its own display
   * name is being attached), never by `buildAgentResponse` itself.
   * Absent for the Orchestrator's own fallback responses (unknown
   * intent, no agent registered) since no agent ran. Powers the subtle
   * "Spending Agent" badge in ChatBubble — see `src/types/ai.ts`
   * `makeAgentRoutingRecord`.
   */
  agentName?: string;
}

/**
 * The common contract every specialist (and the future ones not yet
 * implemented) must satisfy. `allowedTools` is enforced, not just
 * documented — see toolAccess.ts: an agent's `execute` receives a
 * `ToolExecutor` that throws if asked for a tool outside this list, so
 * there is no way for an agent to reach a tool it wasn't given.
 */
export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  supportedIntents: AgentIntent[];
  allowedTools: string[];
  execute(request: AgentRequest, context: AgentContext, tools: ToolExecutor): Promise<AgentResponse>;
}

/** Small helper so every agent builds its response the same way instead of hand-assembling objects. */
export function buildAgentResponse(partial: {
  claims: AgentClaim[];
  warnings?: string[];
  toolResults?: ToolCallRecord[];
  followUpSuggestions?: string[];
  metadata?: Record<string, unknown>;
}): AgentResponse {
  const order: ClaimKind[] = ['fact', 'calculation', 'projection', 'assumption', 'ai_interpretation'];
  const LABELS: Record<ClaimKind, string> = {
    fact: 'FACT',
    calculation: 'CALCULATION',
    projection: 'PROJECTION',
    assumption: 'ASSUMPTION',
    ai_interpretation: 'INTERPRETATION',
  };

  const lines = order
    .flatMap((kind) => partial.claims.filter((c) => c.kind === kind))
    .map((claim) => `${LABELS[claim.kind]}: ${claim.text}`);

  const followUps = partial.followUpSuggestions ?? [];
  const message = [...lines, ...partial.warnings ?? [], ...followUps].join('\n');

  return {
    message,
    claims: partial.claims,
    warnings: partial.warnings ?? [],
    toolResults: partial.toolResults ?? [],
    followUpSuggestions: followUps,
    metadata: partial.metadata,
  };
}
