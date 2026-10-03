import type { AgentDefinition } from './types';

/**
 * NOT IMPLEMENTED — interface only, per this phase's brief (section 25:
 * "prepare interfaces... do not fully implement unless explicitly
 * requested"). `supportedIntents` is empty because the current intent
 * taxonomy (AgentIntent) has no "financial_safety" entry, so the
 * Orchestrator can never route here. Future scope: deterministic
 * constraint/warning checks (e.g. "this would put you below your reserve
 * for the next 30 days") that other agents could call into rather than
 * each re-implementing the same safety checks.
 */
export const financialSafetyAgent: AgentDefinition = {
  id: 'financial_safety',
  name: 'Financial Safety Agent',
  description: 'Not yet implemented — will check deterministic financial constraints/warnings in a future phase.',
  supportedIntents: [],
  allowedTools: [],
  async execute() {
    throw new Error('Financial Safety Agent is not implemented yet.');
  },
};
