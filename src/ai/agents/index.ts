import { AgentRegistry } from './registry';
import { Orchestrator } from './orchestrator';
import { spendingAgent } from './spendingAgent';
import { budgetAgent } from './budgetAgent';
import { goalAgent } from './goalAgent';
import { purchaseAgent } from './purchaseAgent';
import { forecastAgent } from './forecastAgent';
import { subscriptionAgent } from './subscriptionAgent';
import { transactionAgent } from './transactionAgent';
import { generalAgent } from './generalAgent';
import { documentAgent } from './documentAgent';
import { financialSafetyAgent } from './financialSafetyAgent';

export * from './types';
export * from './toolAccess';
export { AgentRegistry } from './registry';
export { Orchestrator, type OrchestratorLLM, type HandleOptions } from './orchestrator';

/**
 * The one registry the app actually uses, with every agent registered.
 * Spending/Budget/Goal are this phase's fully-built specialists;
 * Purchase/Forecast/Subscription/Transactions carry forward behavior that
 * already existed before the agent phase; Document/FinancialSafety are
 * registered-but-unreachable stubs (see their files) — see
 * docs/AI_ARCHITECTURE.md for which is which and why.
 */
export function createDefaultAgentRegistry(): AgentRegistry {
  const registry = new AgentRegistry();
  registry.register(spendingAgent);
  registry.register(budgetAgent);
  registry.register(goalAgent);
  registry.register(purchaseAgent);
  registry.register(forecastAgent);
  registry.register(subscriptionAgent);
  registry.register(transactionAgent);
  registry.register(generalAgent);
  registry.register(documentAgent);
  registry.register(financialSafetyAgent);
  return registry;
}

export const defaultAgentRegistry = createDefaultAgentRegistry();
export const defaultOrchestrator = new Orchestrator(defaultAgentRegistry);
