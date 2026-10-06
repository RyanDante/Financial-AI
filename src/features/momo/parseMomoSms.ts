/**
 * Reads a mobile-money confirmation SMS (MTN MoMo, Orange Money) pasted by
 * the user. Operators change their wording often and mix English and
 * French, so this matches loose patterns instead of one template, never
 * throws, and reports how sure it is. Nothing is saved from here: the
 * import screen shows every field for the user to confirm first.
 *
 * Amounts are whole FCFA (XAF has no minor unit), so separators are
 * stripped: "10 000", "10,000" and "10.000" are all 10000.
 */
export type MomoKind = 'received' | 'sent' | 'payment' | 'withdrawal' | 'deposit';
export type MomoOperator = 'mtn' | 'orange' | 'unknown';

export interface MomoFields {
  kind: MomoKind | null;
  operator: MomoOperator;
  amount: number | null;
  fee: number | null;
  balance: number | null;
  counterparty: string | null;
  reference: string | null;
  occurredAt: string | null;
}

export interface MomoParseResult {
  ok: boolean;
  confidence: 'high' | 'medium' | 'low';
  fields: MomoFields;
  /** Which fields could not be found, for the review card. */
  missing: (keyof MomoFields)[];
  raw: string;
}

const CURRENCY = '(?:FCFA|F\\s?CFA|XAF|CFA)';
const NUMBER = '(\\d[\\d\\s.,]*\\d|\\d)';
const AMOUNT_AFTER = new RegExp(`${NUMBER}\\s*${CURRENCY}`, 'gi');
const AMOUNT_BEFORE = new RegExp(`${CURRENCY}\\s*${NUMBER}`, 'gi');

const KIND_PATTERNS: [MomoKind, RegExp][] = [
  ['withdrawal', /\b(retrait|withdrawal|withdrawn|cash\s?out)\b/i],
  ['deposit', /\b(d[ée]p[ôo]t|deposit|cash\s?in)\b/i],
  ['received', /\b(re[çc]u|received|vous avez re[çc]u|you have received|credit(?:ed)?)\b/i],
  ['payment', /\b(paiement|payment|paid|pay[ée]|achat|purchase|marchand|merchant)\b/i],
  ['sent', /\b(transfert|transfer(?:red)?|sent|envoy[ée]|debit(?:ed)?)\b/i],
];

export function parseMomoSms(raw: string): MomoParseResult {
  const text = raw.replace(/\s+/g, ' ').trim();
  const fields: MomoFields = {
    kind: detectKind(text),
    operator: /\borange\b|\bOM\b/i.test(text) ? 'orange' : /\bMTN\b|\bmomo\b|mobile money/i.test(text) ? 'mtn' : 'unknown',
    amount: null,
    fee: null,
    balance: null,
    counterparty: detectCounterparty(text),
    reference: detectReference(text),
    occurredAt: detectDate(text),
  };

  for (const { value, index } of findAmounts(text)) {
    const before = text.slice(Math.max(0, index - 28), index).toLowerCase();
    if (/(frais|fee|fees|commission|charges?)\W*(de|of|:)?\W*$/.test(before) && fields.fee === null) fields.fee = value;
    else if (/(solde|balance)\b[^.]*$/.test(before) && fields.balance === null) fields.balance = value;
    else if (fields.amount === null) fields.amount = value;
  }

  const missing = (Object.keys(fields) as (keyof MomoFields)[]).filter((k) => fields[k] === null);
  const ok = fields.amount !== null && fields.amount > 0;
  const confidence = ok && fields.kind ? (fields.reference || fields.counterparty ? 'high' : 'medium') : 'low';
  return { ok, confidence, fields, missing, raw };
}

/** Splits a paste of several SMS on blank lines. */
export function splitMessages(paste: string): string[] {
  return paste
    .split(/\n\s*\n/)
    .map((m) => m.trim())
    .filter((m) => m.length > 0);
}

/** Where an imported transaction remembers its SMS, so the same message isn't imported twice. */
export function referenceNote(reference: string): string {
  return `MoMo ref ${reference}`;
}

function findAmounts(text: string): { value: number; index: number }[] {
  const found: { value: number; index: number }[] = [];
  for (const pattern of [AMOUNT_AFTER, AMOUNT_BEFORE]) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const value = Number(match[1].replace(/[\s.,]/g, ''));
      if (Number.isFinite(value) && value > 0) found.push({ value, index: match.index ?? 0 });
    }
  }
  // Same amount matched by both patterns (e.g. "XAF 500 FCFA") only counts once.
  return found.sort((a, b) => a.index - b.index).filter((f, i, all) => i === 0 || Math.abs(f.index - all[i - 1].index) > 3);
}

function detectKind(text: string): MomoKind | null {
  for (const [kind, pattern] of KIND_PATTERNS) if (pattern.test(text)) return kind;
  return null;
}

function detectCounterparty(text: string): string | null {
  const phone = text.match(/\b(?:\+?237)?\s?(6\d{8})\b/);
  const named = text.match(/\b(?:à|a|to|de|from|chez|par|by)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.-]+(?:\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.-]+){0,3})(?=\s*(?:\(|,|\.|\d|le\b|on\b|du\b|au\b|$))/);
  // Stop at the first word that continues the sentence ("ENEO CAMEROUN effectue le …").
  const STOP = /^(effectu[ée]e?|successful|r[ée]ussie?|done|completed|le|la|on|du|au|for|pour|avec|with|via)$/i;
  const words = named?.[1]?.trim().split(/\s+/) ?? [];
  const cut = words.findIndex((w) => STOP.test(w));
  const name = (cut === -1 ? words : words.slice(0, cut)).join(' ') || undefined;
  const isNoise = name && /^(votre|your|compte|account|mobile|money|momo|orange|mtn|la|le|the|fcfa|xaf)$/i.test(name.split(' ')[0]);
  if (name && !isNoise) return phone ? `${name} (${phone[1]})` : name;
  return phone ? phone[1] : null;
}

function detectReference(text: string): string | null {
  const match = text.match(/\b(?:financial transaction id|transaction id|trans(?:action)?\s*id|txn\s*id|id\s*transaction|r[ée]f(?:[ée]rence)?|ref|id)\s*[:#]?\s*([A-Z0-9][A-Z0-9.-]{5,})/i);
  return match ? match[1].replace(/\.$/, '') : null;
}

/** "12/09/2026 14:03", "2026-09-12 14:03:22" or "12-09-26". Day first, as in Cameroon. */
function detectDate(text: string): string | null {
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (iso) return toISO(+iso[1], +iso[2], +iso[3], iso[4], iso[5]);
  const dmy = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(?:à\s+|at\s+)?(\d{1,2})[:h](\d{2}))?/);
  if (dmy) {
    const year = +dmy[3] < 100 ? 2000 + +dmy[3] : +dmy[3];
    return toISO(year, +dmy[2], +dmy[1], dmy[4], dmy[5]);
  }
  return null;
}

function toISO(year: number, month: number, day: number, hour?: string, minute?: string): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day, hour ? +hour : 12, minute ? +minute : 0);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
