import { transactionAgent } from './transactionAgent';
import type { AgentContext, AgentRequest } from './types';
import type { ToolExecutor } from './toolAccess';

const context: AgentContext = { currency: 'XAF' };

function request(text: string): AgentRequest {
  return { text, intent: 'transactions', entities: {} };
}

function fakeTools(responses: Record<string, unknown>): ToolExecutor {
  return { execute: jest.fn(async (name: string) => responses[name]) };
}

const tx = (overrides: Partial<{ merchant: string | null; description: string | null; amountMinor: number; type: string; occurredAt: string }>) => ({
  merchant: 'Supermarket',
  description: null,
  amountMinor: 5000,
  currency: 'XAF',
  type: 'expense',
  occurredAt: '2026-01-10T00:00:00.000Z',
  ...overrides,
});

describe('transactionAgent — transaction lookup', () => {
  it('reports the most recent transaction when no specific one can be resolved from text', async () => {
    const tools = fakeTools({ getTransactions: [tx({ merchant: 'Corner Shop', amountMinor: 3200 })] });

    const response = await transactionAgent.execute(request('Analyze this transaction.'), context, tools);

    expect(tools.execute).toHaveBeenCalledWith('getTransactions', { limit: 1 });
    expect(response.message).toContain('Corner Shop');
    expect(response.message).toContain("can't yet tell which specific transaction");
  });
});

describe('transactionAgent — transaction list', () => {
  it('lists transactions from the last week using a date-range filter', async () => {
    const tools = fakeTools({
      getTransactions: [tx({ merchant: 'Corner Shop' }), tx({ merchant: 'Gas Station', amountMinor: 20000 })],
    });

    const response = await transactionAgent.execute(request('Show me transactions from last week.'), context, tools);

    expect(tools.execute).toHaveBeenCalledWith('getTransactions', expect.objectContaining({ from: expect.any(String), to: expect.any(String) }));
    expect(response.message).toContain('Corner Shop');
    expect(response.message).toContain('Gas Station');
  });

  it('sorts by amount, largest first, for a "largest transactions" request', async () => {
    const tools = fakeTools({
      getTransactions: [tx({ merchant: 'Small', amountMinor: 1000 }), tx({ merchant: 'Big', amountMinor: 500000 })],
    });

    const response = await transactionAgent.execute(request('Find my largest transactions.'), context, tools);

    expect(tools.execute).toHaveBeenCalledWith('getTransactions', {});
    const bigLine = response.message.split('\n').findIndex((l) => l.includes('Big'));
    const smallLine = response.message.split('\n').findIndex((l) => l.includes('Small'));
    expect(bigLine).toBeLessThan(smallLine);
  });
});

describe('transactionAgent — missing transaction', () => {
  it('reports no transactions rather than fabricating one', async () => {
    const tools = fakeTools({ getTransactions: [] });

    const response = await transactionAgent.execute(request('Analyze this transaction.'), context, tools);

    expect(response.message).toBe('FACT: No transactions recorded yet.');
  });

  it('reports none-in-range for an empty last-week result', async () => {
    const tools = fakeTools({ getTransactions: [] });

    const response = await transactionAgent.execute(request('Show me transactions from last week.'), context, tools);

    expect(response.message).toBe('FACT: No transactions recorded in the last week.');
  });
});

describe('transactionAgent — tool failure', () => {
  it('propagates a tool failure rather than silently fabricating an answer', async () => {
    const tools: ToolExecutor = {
      execute: async () => {
        throw new Error('transactions repository unavailable');
      },
    };

    await expect(transactionAgent.execute(request('Analyze this transaction.'), context, tools)).rejects.toThrow('transactions repository unavailable');
  });
});
