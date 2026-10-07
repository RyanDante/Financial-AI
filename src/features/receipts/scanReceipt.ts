import type { LLMClient, LLMImage, LLMToolSpec } from '@/ai/llm/types';
import { LLMError } from '@/ai/llm/types';

const TOOL_NAME = 'record_receipt';

export interface ReceiptCategory {
  id: string;
  name: string;
}

export interface ReceiptScan {
  merchant: string | null;
  /** The total in major units as printed (12500 FCFA -> 12500, $12.50 -> 12.5). */
  total: number;
  /** ISO code when the receipt shows one (FCFA -> XAF), else null. */
  currency: string | null;
  /** ISO date, never in the future; null when the receipt has none. */
  date: string | null;
  categoryId: string | null;
}

function tool(categories: ReceiptCategory[]): LLMToolSpec {
  return {
    name: TOOL_NAME,
    description: 'Records what a purchase receipt says.',
    parameters: {
      type: 'object',
      properties: {
        isReceipt: { type: 'boolean', description: 'false when the picture is not a receipt or invoice, or is unreadable.' },
        merchant: { type: ['string', 'null'], description: 'Shop or business name, or null.' },
        total: { type: ['number', 'null'], description: 'The final amount paid (TOTAL / NET A PAYER), as printed, in major units. Not a subtotal or tax line.' },
        currency: { type: ['string', 'null'], description: 'ISO 4217 code of the total (FCFA/CFA -> XAF), or null when not shown.' },
        date: { type: ['string', 'null'], description: 'Purchase date as YYYY-MM-DD, or null.' },
        category: { type: ['string', 'null'], enum: [...categories.map((c) => c.name), null] as (string | number)[], description: 'The best-fitting spending category, or null.' },
      },
      required: ['isReceipt', 'merchant', 'total', 'currency', 'date', 'category'],
    },
  };
}

const SYSTEM = [
  'You read photos of purchase receipts and invoices, in English or French.',
  `Always answer by calling ${TOOL_NAME} exactly once. Copy the total exactly as printed; never compute or guess it. Use null for anything you cannot read.`,
].join('\n');

/** Reads a receipt photo with the configured model. Throws a readable error when it isn't a usable receipt. */
export async function scanReceipt(client: LLMClient, image: LLMImage, categories: ReceiptCategory[]): Promise<ReceiptScan> {
  const response = await client.complete({
    system: SYSTEM,
    turns: [{ role: 'user', text: 'Record this receipt.', images: [image] }],
    tools: [tool(categories)],
    maxTokens: 2048,
    timeoutMs: 60_000,
  });
  const call = response.toolCalls.find((c) => c.name === TOOL_NAME);
  if (!call) throw new LLMError('The AI could not read this receipt.', false);
  return toReceiptScan(call.input, categories);
}

/** Validates the model's answer: a positive total is required, the date can't be in the future. */
export function toReceiptScan(input: Record<string, unknown>, categories: ReceiptCategory[], now = new Date()): ReceiptScan {
  if (input.isReceipt === false) throw new LLMError("That doesn't look like a receipt.", false);
  const total = typeof input.total === 'number' ? input.total : typeof input.total === 'string' ? Number(input.total.replace(/[\s,]/g, '')) : NaN;
  if (!Number.isFinite(total) || total <= 0) throw new LLMError("The total couldn't be read from this receipt.", false);

  const merchant = typeof input.merchant === 'string' && input.merchant.trim() ? input.merchant.trim() : null;
  const currency = typeof input.currency === 'string' && /^[A-Za-z]{3}$/.test(input.currency.trim()) ? input.currency.trim().toUpperCase() : null;

  let date: string | null = null;
  if (typeof input.date === 'string') {
    const parsed = new Date(input.date);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() <= now.getTime()) date = parsed.toISOString();
  }

  return { merchant, total, currency, date, categoryId: matchCategory(input.category, categories) };
}

/** The category the model named, matched by name, ignoring case and accents. */
export function matchCategory(name: unknown, categories: ReceiptCategory[]): string | null {
  if (typeof name !== 'string' || !name.trim()) return null;
  const key = normalize(name);
  return categories.find((c) => normalize(c.name) === key)?.id ?? categories.find((c) => normalize(c.name).includes(key) || key.includes(normalize(c.name)))?.id ?? null;
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
