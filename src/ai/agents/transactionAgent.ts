import { formatMoney } from '@/utils/currency';
import type { CurrencyCode } from '@/constants/currencies';
import { lastWeekRange } from './dateEntities';
import { buildAgentResponse, type AgentDefinition } from './types';

export const TRANSACTION_AGENT_TOOLS = ['getTransactions'];

interface TransactionShape {
  merchant: string | null;
  description: string | null;
  amountMinor: number;
  currency: string;
  type: string;
  occurredAt: string;
}

function mentionsLastWeek(text: string): boolean {
  return /\blast week\b/i.test(text);
}

function mentionsLargest(text: string): boolean {
  return /\blargest\b|\bbiggest\b/i.test(text);
}

function describeTransaction(tx: TransactionShape, currency: CurrencyCode): string {
  const label = tx.merchant ?? tx.description ?? 'Unlabeled transaction';
  return `${label}, ${formatMoney(tx.amountMinor, currency)} (${tx.type}) on ${new Date(tx.occurredAt).toLocaleDateString()}`;
}

/**
 * Read-only. Uses only getTransactions — "last week" and "largest" are
 * presentation choices (a date-range filter and a sort by amount) made
 * here over data the tool already returns, not new financial math. There
 * is still no way to resolve "this transaction" to a specific one from
 * text alone without UI-level context (e.g. the transaction detail screen
 * passing an id), so that case falls back to the most recent transaction
 * rather than fabricating detail about one it can't identify.
 */
export const transactionAgent: AgentDefinition = {
  id: 'transactions',
  name: 'Transaction Agent',
  description: 'Reports recent, last-week, or largest transactions. Limited: cannot yet resolve "this transaction" to a specific one without screen context.',
  supportedIntents: ['transactions'],
  allowedTools: TRANSACTION_AGENT_TOOLS,

  async execute(request, context, tools) {
    if (mentionsLastWeek(request.text)) {
      const { from, to } = lastWeekRange();
      const transactions = (await tools.execute('getTransactions', { from, to })) as TransactionShape[];
      if (transactions.length === 0) {
        return buildAgentResponse({ claims: [{ kind: 'fact', text: 'No transactions recorded in the last week.' }] });
      }
      const lines = transactions.map((tx) => `  - ${describeTransaction(tx, context.currency)}`);
      return buildAgentResponse({ claims: [{ kind: 'fact', text: `Transactions from the last week:\n${lines.join('\n')}` }] });
    }

    if (mentionsLargest(request.text)) {
      const transactions = (await tools.execute('getTransactions', {})) as TransactionShape[];
      if (transactions.length === 0) {
        return buildAgentResponse({ claims: [{ kind: 'fact', text: 'No transactions recorded yet.' }] });
      }
      const largest = [...transactions].sort((a, b) => Math.abs(b.amountMinor) - Math.abs(a.amountMinor)).slice(0, 5);
      const lines = largest.map((tx) => `  - ${describeTransaction(tx, context.currency)}`);
      return buildAgentResponse({ claims: [{ kind: 'fact', text: `Your largest transactions:\n${lines.join('\n')}` }] });
    }

    const transactions = (await tools.execute('getTransactions', { limit: 1 })) as TransactionShape[];
    if (transactions.length === 0) {
      return buildAgentResponse({ claims: [{ kind: 'fact', text: 'No transactions recorded yet.' }] });
    }

    return buildAgentResponse({
      claims: [
        { kind: 'fact', text: `Most recent transaction: ${describeTransaction(transactions[0], context.currency)}.` },
        { kind: 'ai_interpretation', text: "I can't yet tell which specific transaction you mean from text alone — open it from the Transactions list for full detail." },
      ],
    });
  },
};
