export type AIMessageRole = 'user' | 'assistant' | 'tool' | 'system';

export interface AIConversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A single tool invocation recorded alongside an assistant message, for the "checking: balance / obligations / budget" UI. */
export interface ToolCallRecord {
  toolName: string;
  input: unknown;
  output: unknown;
}

export interface AIMessage {
  id: string;
  conversationId: string;
  role: AIMessageRole;
  content: string;
  toolCalls: ToolCallRecord[] | null;
  createdAt: string;
}

/**
 * The FACT / CALCULATION / PROJECTION / ASSUMPTION / AI INTERPRETATION
 * distinction the product spec requires be surfaceable in the UI. Tool
 * outputs and engine results are tagged with this so the AI explanation
 * layer (and eventually the UI) never blurs a deterministic number into an
 * opinion.
 */
export type ClaimKind = 'fact' | 'calculation' | 'projection' | 'assumption' | 'ai_interpretation';

export interface LabeledClaim {
  kind: ClaimKind;
  text: string;
}

/**
 * A synthetic, non-tool entry in `toolCalls` that carries which agent
 * handled a message — e.g. "Spending Agent" — for the subtle routing
 * indicator in ChatBubble. It rides in the existing `tool_calls_json`
 * column (see `aiRepository.addMessage`) so the badge survives a reload
 * without a database schema change. `extractAgentName` /
 * `visibleToolCalls` are the only places that should know this
 * convention exists — everywhere else just sees `ToolCallRecord[]`.
 */
export const AGENT_ROUTING_TOOL_NAME = '__agent_routing__';

export function makeAgentRoutingRecord(agentName: string): ToolCallRecord {
  return { toolName: AGENT_ROUTING_TOOL_NAME, input: null, output: { agentName } };
}

/** The agent name from a message's toolCalls, if the Orchestrator attached one. */
export function extractAgentName(toolCalls: ToolCallRecord[] | null | undefined): string | null {
  const marker = toolCalls?.find((tc) => tc.toolName === AGENT_ROUTING_TOOL_NAME);
  if (!marker) return null;
  return (marker.output as { agentName: string } | null)?.agentName ?? null;
}

/** toolCalls with the routing marker filtered out — what the "Checked: ..." caption should actually list. */
export function visibleToolCalls(toolCalls: ToolCallRecord[] | null | undefined): ToolCallRecord[] {
  return (toolCalls ?? []).filter((tc) => tc.toolName !== AGENT_ROUTING_TOOL_NAME);
}
