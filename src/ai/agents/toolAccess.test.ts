import { createScopedTools } from './toolAccess';

function fakeExecutor(responses: Record<string, unknown>) {
  return {
    execute: jest.fn(async (name: string) => responses[name]),
  };
}

describe('createScopedTools', () => {
  it('allows calling a tool in the allowlist and records the call', async () => {
    const underlying = fakeExecutor({ getBalance: { totalBalanceMinor: 100 } });
    const scoped = createScopedTools(underlying, ['getBalance']);

    const result = await scoped.execute('getBalance', { currency: 'XAF' });

    expect(result).toEqual({ totalBalanceMinor: 100 });
    expect(underlying.execute).toHaveBeenCalledWith('getBalance', { currency: 'XAF' });
    expect(scoped.getCalls()).toEqual([{ toolName: 'getBalance', input: { currency: 'XAF' }, output: { totalBalanceMinor: 100 } }]);
  });

  it('accumulates multiple calls in order', async () => {
    const underlying = fakeExecutor({ getBalance: { total: 1 }, getAccounts: [{ id: 'a' }] });
    const scoped = createScopedTools(underlying, ['getBalance', 'getAccounts']);

    await scoped.execute('getBalance', {});
    await scoped.execute('getAccounts', {});

    expect(scoped.getCalls().map((c) => c.toolName)).toEqual(['getBalance', 'getAccounts']);
  });

  it('rejects a tool not in the allowlist without ever calling the underlying executor', async () => {
    const underlying = fakeExecutor({ getBalance: {} });
    const scoped = createScopedTools(underlying, ['getSpending']);

    await expect(scoped.execute('getBalance', {})).rejects.toThrow(/not in this agent's allowlist/);
    expect(underlying.execute).not.toHaveBeenCalled();
  });

  it('does not record a call for a rejected tool', async () => {
    const underlying = fakeExecutor({});
    const scoped = createScopedTools(underlying, []);

    await expect(scoped.execute('anything', {})).rejects.toThrow();
    expect(scoped.getCalls()).toEqual([]);
  });
});
