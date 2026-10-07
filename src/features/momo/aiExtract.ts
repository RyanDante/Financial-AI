import type { LLMClient, LLMImage, LLMToolSpec } from '@/ai/llm/types';
import { LLMError } from '@/ai/llm/types';
import type { MomoFields, MomoKind, MomoOperator, MomoParseResult } from './parseMomoSms';
import { t } from '@/i18n';

const TOOL_NAME = 'record_momo_messages';
const KINDS: MomoKind[] = ['received', 'sent', 'payment', 'withdrawal', 'deposit'];
const OPERATORS: MomoOperator[] = ['mtn', 'orange', 'unknown'];

const TOOL: LLMToolSpec = {
  name: TOOL_NAME,
  description: 'Records every mobile-money transaction message found in the input, one entry per message.',
  parameters: {
    type: 'object',
    properties: {
      messages: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            kind: {
              type: 'string',
              enum: KINDS,
              description:
                'received = money came in from a person; deposit = cash put in at an agent (cash in); sent = transfer to a person (debit); payment = paid a merchant or bill (debit); withdrawal = cash taken out at an agent (cash out).',
            },
            operator: { type: 'string', enum: OPERATORS },
            amount: { type: 'integer', description: 'The transaction amount in FCFA, digits only (15 000 FCFA -> 15000). Not the fee, not the balance.' },
            fee: { type: ['integer', 'null'], description: 'Fees or commission in FCFA, or null.' },
            balance: { type: ['integer', 'null'], description: 'The new balance in FCFA, or null.' },
            counterparty: { type: ['string', 'null'], description: 'The other person or merchant (name and/or number), or null.' },
            reference: { type: ['string', 'null'], description: 'Transaction ID / reference, or null.' },
            occurredAt: { type: ['string', 'null'], description: 'Date and time as ISO 8601 (e.g. 2026-10-07T14:30:00), or null when absent.' },
            sourceText: { type: 'string', description: 'The text of this message exactly as written.' },
          },
          required: ['kind', 'operator', 'amount', 'fee', 'balance', 'counterparty', 'reference', 'occurredAt', 'sourceText'],
        },
      },
    },
    required: ['messages'],
  },
};

const SYSTEM = [
  'You read MTN Mobile Money and Orange Money confirmation SMS from Cameroon, in English or French, and record each transaction.',
  `Always answer by calling ${TOOL_NAME} exactly once, with one entry per transaction message. Ignore promotions and messages that are not transactions.`,
  'Copy numbers exactly as written; never compute, round or guess an amount. Use null for anything not in the message.',
].join('\n');

export interface AIReadMessage {
  parsed: MomoParseResult;
  /** Read from a picture: the amounts could not be checked against text. */
  fromImage: boolean;
}

/**
 * Reads mobile-money messages with the configured model, from pasted text
 * or a screenshot. Amounts read from text are kept only if those digits
 * appear in the message, so the model can't invent a number; amounts from
 * a picture are flagged for the user to check.
 */
export async function extractMomoWithAI(client: LLMClient, input: { text?: string; image?: LLMImage }): Promise<AIReadMessage[]> {
  const text = input.text?.trim() ?? '';
  const prompt = input.image
    ? 'Record the mobile-money transaction messages shown in this screenshot.'
    : `Record the mobile-money transaction messages below.\n\n<messages>\n${text}\n</messages>`;

  const response = await client.complete({
    system: SYSTEM,
    turns: [{ role: 'user', text: prompt, images: input.image ? [input.image] : undefined }],
    tools: [TOOL],
    maxTokens: 4096,
    timeoutMs: input.image ? 60_000 : 30_000,
  });

  const call = response.toolCalls.find((c) => c.name === TOOL_NAME);
  if (!call) throw new LLMError(t('sms.aiUnreadable'), false);
  return toReadMessages(call.input.messages, input.image ? null : text);
}

/**
 * Turns the model's entries into review cards. With `sourceText`, every
 * amount, fee and balance must appear in it (in any spacing: 15000,
 * "15 000", "15,000"); one that doesn't is dropped as a guess.
 */
export function toReadMessages(entries: unknown, sourceText: string | null): AIReadMessage[] {
  if (!Array.isArray(entries)) return [];
  return entries.filter(isRecord).map((entry) => {
    const raw = str(entry.sourceText) ?? sourceText ?? '';
    const checkIn = sourceText === null ? null : raw || sourceText;
    const keep = (value: number | null) => (value === null || checkIn === null || amountAppearsIn(checkIn, value) ? value : null);

    const fields: MomoFields = {
      kind: KINDS.includes(entry.kind as MomoKind) ? (entry.kind as MomoKind) : null,
      operator: OPERATORS.includes(entry.operator as MomoOperator) ? (entry.operator as MomoOperator) : 'unknown',
      amount: keep(int(entry.amount)),
      fee: keep(int(entry.fee)),
      balance: keep(int(entry.balance)),
      counterparty: str(entry.counterparty),
      reference: str(entry.reference),
      occurredAt: isoDate(entry.occurredAt),
    };
    const missing = (Object.keys(fields) as (keyof MomoFields)[]).filter((k) => fields[k] === null);
    const ok = fields.amount !== null && fields.amount > 0;
    const confidence: MomoParseResult['confidence'] = !ok || !fields.kind ? 'low' : sourceText === null ? 'medium' : 'high';
    return { parsed: { ok, confidence, fields, missing, raw }, fromImage: sourceText === null };
  });
}

/** True when `amount` is written in `text`, allowing thousands separators and a ".00" tail. */
export function amountAppearsIn(text: string, amount: number): boolean {
  const digits = String(Math.trunc(Math.abs(amount)));
  const pattern = new RegExp(`(?:^|[^\\d])${digits.split('').join('[\\s.,\\u00a0\\u202f]?')}(?:[.,]0{1,2})?(?![\\d])`);
  return pattern.test(text);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function int(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value.replace(/[\s.,]/g, '')) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
