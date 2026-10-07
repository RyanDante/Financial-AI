import type { LLMClient, LLMRequest, LLMResponse } from '@/ai/llm/types';
import { amountAppearsIn, extractMomoWithAI, toReadMessages } from './aiExtract';

const SMS = 'Vous avez transfere 15 000 FCFA a JEAN (237670000000). Frais 150 FCFA. Nouveau solde: 42.350 FCFA. ID: 123456789.';

function entry(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'sent',
    operator: 'mtn',
    amount: 15000,
    fee: 150,
    balance: 42350,
    counterparty: 'JEAN (237670000000)',
    reference: '123456789',
    occurredAt: null,
    sourceText: SMS,
    ...overrides,
  };
}

function fakeClient(input: Record<string, unknown> | null): LLMClient & { requests: LLMRequest[] } {
  const requests: LLMRequest[] = [];
  return {
    provider: 'fake',
    model: 'fake',
    requests,
    async complete(request): Promise<LLMResponse> {
      requests.push(request);
      return input
        ? { text: '', toolCalls: [{ id: '1', name: 'record_momo_messages', input }], stopReason: 'tool_use' }
        : { text: 'Sorry', toolCalls: [], stopReason: 'end' };
    },
  };
}

describe('amountAppearsIn', () => {
  it('matches any thousands separator', () => {
    expect(amountAppearsIn(SMS, 15000)).toBe(true);
    expect(amountAppearsIn(SMS, 42350)).toBe(true);
    expect(amountAppearsIn('Montant 15,000.00 XAF', 15000)).toBe(true);
  });
  it('rejects numbers that are not written', () => {
    expect(amountAppearsIn(SMS, 16000)).toBe(false);
    expect(amountAppearsIn(SMS, 1500)).toBe(false);
    expect(amountAppearsIn(SMS, 5000)).toBe(false);
  });
});

describe('toReadMessages', () => {
  it('keeps amounts that appear in the SMS', () => {
    const [read] = toReadMessages([entry()], SMS);
    expect(read.fromImage).toBe(false);
    expect(read.parsed.ok).toBe(true);
    expect(read.parsed.confidence).toBe('high');
    expect(read.parsed.fields).toMatchObject({ kind: 'sent', amount: 15000, fee: 150, balance: 42350, reference: '123456789' });
  });

  it('drops an amount the model made up', () => {
    const [read] = toReadMessages([entry({ amount: 16000, fee: 999 })], SMS);
    expect(read.parsed.fields.amount).toBeNull();
    expect(read.parsed.fields.fee).toBeNull();
    expect(read.parsed.ok).toBe(false);
    expect(read.parsed.confidence).toBe('low');
  });

  it('marks screenshot reads as unchecked', () => {
    const [read] = toReadMessages([entry({ amount: 16000 })], null);
    expect(read.fromImage).toBe(true);
    expect(read.parsed.fields.amount).toBe(16000);
    expect(read.parsed.confidence).toBe('medium');
  });

  it('ignores bad kinds and malformed entries', () => {
    const reads = toReadMessages([entry({ kind: 'loan' }), 'nonsense', null], SMS);
    expect(reads).toHaveLength(1);
    expect(reads[0].parsed.fields.kind).toBeNull();
    expect(toReadMessages('not a list', SMS)).toEqual([]);
  });
});

describe('extractMomoWithAI', () => {
  it('sends the text and returns checked cards', async () => {
    const client = fakeClient({ messages: [entry()] });
    const reads = await extractMomoWithAI(client, { text: SMS });
    expect(reads).toHaveLength(1);
    const turn = client.requests[0].turns[0];
    expect(turn.role === 'user' && turn.text.includes('15 000 FCFA')).toBe(true);
  });

  it('sends a screenshot as an image', async () => {
    const client = fakeClient({ messages: [entry()] });
    await extractMomoWithAI(client, { image: { base64: 'abc', mediaType: 'image/jpeg' } });
    const turn = client.requests[0].turns[0];
    expect(turn.role === 'user' && turn.images?.[0].base64).toBe('abc');
  });

  it('fails clearly when the model does not call the tool', async () => {
    await expect(extractMomoWithAI(fakeClient(null), { text: SMS })).rejects.toThrow('could not read');
  });
});
