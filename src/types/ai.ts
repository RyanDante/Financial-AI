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
