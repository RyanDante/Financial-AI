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
  /** Lightweight JSON-schema-like description of the input shape, for provider prompting and documentation. Not a strict runtime validator in this phase. */
  inputSchema: Record<string, unknown>;
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

  async execute(name: string, input: unknown): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return tool.execute(input);
  }
}
