import { validateInput } from './validate';
import type { JSONSchema } from '@/ai/llm/types';

const schema: JSONSchema = {
  type: 'object',
  properties: {
    month: { type: 'string' },
    type: { type: 'string', enum: ['income', 'expense', 'transfer'] },
    limit: { type: 'integer', minimum: 1, maximum: 200 },
  },
  required: ['month'],
  additionalProperties: false,
};

describe('validateInput', () => {
  it('accepts valid input, including omitted optional fields', () => {
    expect(validateInput(schema, { month: '2026-09' })).toEqual([]);
    expect(validateInput(schema, { month: '2026-09', type: 'expense', limit: 20 })).toEqual([]);
  });

  it('reports missing, mistyped, out-of-range and unknown fields', () => {
    expect(validateInput(schema, {})).toEqual(['input.month is required']);
    expect(validateInput(schema, { month: 202609 })).toEqual(['input.month must be string']);
    expect(validateInput(schema, { month: '2026-09', type: 'loan' })).toEqual(['input.type must be one of "income", "expense", "transfer"']);
    expect(validateInput(schema, { month: '2026-09', limit: 0.5 })).toEqual(['input.limit must be integer']);
    expect(validateInput(schema, { month: '2026-09', limit: 500 })).toEqual(['input.limit must be ≤ 200']);
    expect(validateInput(schema, { month: '2026-09', extra: true })).toEqual(['input.extra is not a known field']);
  });

  it('rejects a non-object top level', () => {
    expect(validateInput(schema, 'September')).toEqual(['input must be object']);
  });
});
