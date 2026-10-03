import type { ToolCallRecord } from '@/types/ai';

/**
 * The minimal shape an agent needs from the tool layer — deliberately
 * not importing the concrete `ToolRegistry` class, so tests can pass a
 * plain fake object instead of constructing the real SQLite-backed
 * registry (see agent test files).
 */
export interface ToolExecutor {
  execute(name: string, input: unknown): Promise<unknown>;
}

/** A ToolExecutor that also remembers every call made through it, in order. */
export interface ScopedToolExecutor extends ToolExecutor {
  getCalls(): ToolCallRecord[];
}

/**
 * Wraps a tool registry so a given agent can only call the tools in its
 * own `allowedTools` list — this is the actual security boundary from
 * docs/AI_ARCHITECTURE.md "Tool access control", not just a convention.
 * The returned wrapper also accumulates every call (and its result) so
 * the caller can read `getCalls()` afterward and attach it to the
 * `AgentResponse.toolResults` the agent itself has no way to populate
 * (an agent only ever sees `execute`, never the accumulator — passing
 * the narrower `ToolExecutor` type to `AgentDefinition.execute` is what
 * keeps that true).
 */
export function createScopedTools(executor: ToolExecutor, allowedTools: string[]): ScopedToolExecutor {
  const calls: ToolCallRecord[] = [];

  return {
    async execute(name: string, input: unknown): Promise<unknown> {
      if (!allowedTools.includes(name)) {
        throw new Error(`Tool "${name}" is not in this agent's allowlist (${allowedTools.join(', ')})`);
      }
      const output = await executor.execute(name, input);
      calls.push({ toolName: name, input, output });
      return output;
    },
    getCalls(): ToolCallRecord[] {
      return calls;
    },
  };
}
