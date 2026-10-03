import type { AgentDefinition, AgentIntent } from './types';

/**
 * Where every agent lives, keyed by id and discoverable by intent. The
 * Orchestrator resolves agents through this instead of a hardcoded
 * switch statement, so adding a new specialist later is a `register()`
 * call, not an edit to the Orchestrator's routing logic.
 */
export class AgentRegistry {
  private agentsById = new Map<string, AgentDefinition>();

  register(agent: AgentDefinition): void {
    this.agentsById.set(agent.id, agent);
  }

  get(id: string): AgentDefinition | undefined {
    return this.agentsById.get(id);
  }

  /** First registered agent that declares support for this intent. Intents are 1:1 with an agent today, but nothing here assumes that stays true. */
  findByIntent(intent: AgentIntent): AgentDefinition | undefined {
    return this.list().find((agent) => agent.supportedIntents.includes(intent));
  }

  list(): AgentDefinition[] {
    return Array.from(this.agentsById.values());
  }
}
