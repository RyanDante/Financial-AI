import { formatMoney } from '@/utils/currency';
import type { CurrencyCode } from '@/constants/currencies';
import { lastWeekRange } from './dateEntities';
import { buildAgentResponse, type AgentDefinition } from './types';
import { getLanguage, getLocale, t, type MessageKey } from '@/i18n';

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
  const label = tx.merchant ?? tx.description ?? t('ag.tx.unlabeled');
  const type = ['expense', 'income', 'transfer'].includes(tx.type) ? t(`ag.tx.type.${tx.type}` as MessageKey) : tx.type;
  const date = new Date(tx.occurredAt).toLocaleDateString(getLanguage() === 'fr' ? getLocale() : undefined);
  return t('ag.tx.line', { label, amount: formatMoney(tx.amountMinor, currency), type, date });
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
        return buildAgentResponse({ claims: [{ kind: 'fact', text: t('ag.tx.noneLastWeek') }] });
      }
      const lines = transactions.map((tx) => `  - ${describeTransaction(tx, context.currency)}`);
      return buildAgentResponse({ claims: [{ kind: 'fact', text: t('ag.tx.lastWeek', { lines: lines.join('\n') }) }] });
    }

    if (mentionsLargest(request.text)) {
      const transactions = (await tools.execute('getTransactions', {})) as TransactionShape[];
      if (transactions.length === 0) {
        return buildAgentResponse({ claims: [{ kind: 'fact', text: t('ag.tx.noneYet') }] });
      }
      const largest = [...transactions].sort((a, b) => Math.abs(b.amountMinor) - Math.abs(a.amountMinor)).slice(0, 5);
      const lines = largest.map((tx) => `  - ${describeTransaction(tx, context.currency)}`);
      return buildAgentResponse({ claims: [{ kind: 'fact', text: t('ag.tx.largest', { lines: lines.join('\n') }) }] });
    }

    const transactions = (await tools.execute('getTransactions', { limit: 1 })) as TransactionShape[];
    if (transactions.length === 0) {
      return buildAgentResponse({ claims: [{ kind: 'fact', text: t('ag.tx.noneYet') }] });
    }

    return buildAgentResponse({
      claims: [
        { kind: 'fact', text: t('ag.tx.mostRecent', { line: describeTransaction(transactions[0], context.currency) }) },
        { kind: 'ai_interpretation', text: t('ag.tx.cantTell') },
      ],
    });
  },
};
