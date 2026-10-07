import type { LLMClient, LLMRequest, LLMResponse } from '@/ai/llm/types';
import { matchCategory, scanReceipt, toReceiptScan } from './scanReceipt';

const CATEGORIES = [
  { id: 'food', name: 'Food' },
  { id: 'transport', name: 'Transport' },
  { id: 'health', name: 'Santé' },
];
const NOW = new Date('2026-10-07T12:00:00Z');

describe('toReceiptScan', () => {
  it('maps a readable receipt', () => {
    const scan = toReceiptScan({ isReceipt: true, merchant: ' Super U ', total: 12500, currency: 'xaf', date: '2026-10-05', category: 'Food' }, CATEGORIES, NOW);
    expect(scan).toEqual({ merchant: 'Super U', total: 12500, currency: 'XAF', date: new Date('2026-10-05').toISOString(), categoryId: 'food' });
  });

  it('rejects a picture that is not a receipt', () => {
    expect(() => toReceiptScan({ isReceipt: false, total: 100 }, CATEGORIES, NOW)).toThrow('look like a receipt');
  });

  it('requires a positive total', () => {
    expect(() => toReceiptScan({ isReceipt: true, total: null }, CATEGORIES, NOW)).toThrow('total');
    expect(() => toReceiptScan({ isReceipt: true, total: 0 }, CATEGORIES, NOW)).toThrow('total');
  });

  it('drops a future date and an invalid currency', () => {
    const scan = toReceiptScan({ isReceipt: true, total: 9.5, currency: 'FCFA', date: '2027-01-01' }, CATEGORIES, NOW);
    expect(scan.date).toBeNull();
    expect(scan.currency).toBeNull();
  });
});

describe('matchCategory', () => {
  it('matches ignoring case and accents', () => {
    expect(matchCategory('sante', CATEGORIES)).toBe('health');
    expect(matchCategory('TRANSPORT', CATEGORIES)).toBe('transport');
  });
  it('returns null for unknown names', () => {
    expect(matchCategory('Rent', CATEGORIES)).toBeNull();
    expect(matchCategory(null, CATEGORIES)).toBeNull();
  });
});

describe('scanReceipt', () => {
  it('sends the photo and the category names', async () => {
    const requests: LLMRequest[] = [];
    const client: LLMClient = {
      provider: 'fake',
      model: 'fake',
      async complete(request): Promise<LLMResponse> {
        requests.push(request);
        return {
          text: '',
          toolCalls: [{ id: '1', name: 'record_receipt', input: { isReceipt: true, merchant: 'Pharmacie', total: 3500, currency: 'XAF', date: null, category: 'Santé' } }],
          stopReason: 'tool_use',
        };
      },
    };
    const scan = await scanReceipt(client, { base64: 'abc', mediaType: 'image/jpeg' }, CATEGORIES);
    expect(scan.categoryId).toBe('health');
    const turn = requests[0].turns[0];
    expect(turn.role === 'user' && turn.images?.length).toBe(1);
    expect(requests[0].tools[0].parameters.properties?.category.enum).toContain('Santé');
  });
});
