import { formatMoney } from '@/utils/currency';
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

/**
 * Minimal, read-only. There's no way yet to tell which specific
 * transaction a message like "analyze this transaction" refers to without
 * UI-level context (e.g. the transaction detail screen passing an id), so
 * this reports the most recent transaction as a best-effort answer rather
 * than fabricating detail about one it can't identify. A real
 * conversation-aware provider could resolve "this" from screen context;
 * this deterministic version can't.
 */
export const transactionAgent: AgentDefinition = {
  id: 'transactions',
  name: 'Transaction Agent',
  description: 'Reports on recent transactions. Limited: cannot yet resolve "this transaction" to a specific one without screen context.',
  supportedIntents: ['transactions'],
  allowedTools: TRANSACTION_AGENT_TOOLS,

  async execute(_request, context, tools) {
    const transactions = (await tools.execute('getTransactions', { limit: 1 })) as TransactionShape[];

    if (transactions.length === 0) {
      return buildAgentResponse({ claims: [{ kind: 'fact', text: 'No transactions recorded yet.' }] });
    }

    const tx = transactions[0];
    const label = tx.merchant ?? tx.description ?? 'Unlabeled transaction';

    return buildAgentResponse({
      claims: [
        {
          kind: 'fact',
          text: `Most recent transaction: ${label}, ${formatMoney(tx.amountMinor, context.currency)} (${tx.type}) on ${new Date(tx.occurredAt).toLocaleDateString()}.`,
        },
        { kind: 'ai_interpretation', text: "I can't yet tell which specific transaction you mean from text alone — open it from the Transactions list for full detail." },
      ],
    });
  },
};
