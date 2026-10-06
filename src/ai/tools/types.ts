import type { JSONSchema, LLMToolSpec } from '@/ai/llm/types';
import { validateInput } from './validate';

/**
 * A tool the AI can call to read or compute financial data. Tools are the
 * ONLY way the AI touches the database or the financial engine — it never
 * runs SQL or invents numbers itself. Each tool's `execute` either reads
 * through a repository or composes a repository read with a financial
 * engine calculation, and always returns plain structured data (never a
 * natural-language string) so the AI can only narrate it, not fabricate it.
 */
export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  /** JSON Schema for the input; sent to the model and enforced by ToolRegistry.execute (see validate.ts). */
  inputSchema: JSONSchema;
  execute: (input: TInput) => Promise<TOutput>;
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): void {
    this.tools.set(tool.name, tool as ToolDefinition);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /** Validates the input against the tool's schema first, so bad model arguments fail loudly and correctably. */
  async execute(name: string, input: unknown): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new ToolInputError(`Unknown tool: ${name}`);
    }
    const normalized = input === undefined || input === null ? {} : input;
    const problems = validateInput(tool.inputSchema, normalized);
    if (problems.length > 0) {
      throw new ToolInputError(`Invalid input for ${name}: ${problems.join('; ')}`);
    }
    return tool.execute(normalized);
  }

  /** The tools as model-facing specs, optionally limited to an allowlist. */
  specs(allowed?: string[]): LLMToolSpec[] {
    return this.list()
      .filter((tool) => !allowed || allowed.includes(tool.name))
      .map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.inputSchema }));
  }
}

/** A tool call the model can fix by sending different arguments (unknown tool, schema violation). */
export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolInputError';
  }
}
