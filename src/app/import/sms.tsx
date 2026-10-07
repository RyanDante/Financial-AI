import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AmountText, Badge, Body, BodySmall, Button, Caption, Card, ChipGroup, Label } from '@/components/ui';
import { transactionsRepository } from '@/database/repositories';
import { useFinanceStore } from '@/store/financeStore';
import { calculateBalance } from '@/finance/calculations';
import { parseMomoSms, referenceNote, splitMessages, type MomoKind, type MomoParseResult } from '@/features/momo/parseMomoSms';
import { useThemeColors } from '@/constants/theme';
import { formatMoney } from '@/utils/currency';
import type { CurrencyCode } from '@/constants/currencies';
import type { NewTransaction, Transaction } from '@/types/finance';

type Direction = 'expense' | 'income';

interface Draft {
  key: string;
  parsed: MomoParseResult;
  include: boolean;
  direction: Direction;
  accountId: string | null;
  categoryId: string | null;
  recordFee: boolean;
  duplicate: boolean;
}

const KIND_LABELS: Record<MomoKind, string> = { received: 'Received', sent: 'Sent', payment: 'Payment', withdrawal: 'Cash out', deposit: 'Cash in' };
const INCOME_KINDS: MomoKind[] = ['received', 'deposit'];
/** MTN MoMo and Orange Money messages are always in FCFA, whatever the app currency. */
const SMS_CURRENCY: CurrencyCode = 'XAF';

/**
 * Turns pasted MTN MoMo / Orange Money SMS into transactions. Every message
 * becomes a card to check (amount, type, account, category, fee) and
 * nothing is saved until "Save". A message whose reference was already
 * imported is unticked and marked, so pasting the same SMS twice doesn't
 * double-count.
 */
export default function ImportSmsScreen() {
  const colors = useThemeColors();
  const { accounts, categories, loadAll } = useFinanceStore();
  const [paste, setPaste] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    transactionsRepository.listTransactions({}).then(setAllTransactions);
  }, []);

  const momoAccount = accounts.find((a) => a.type === 'mobile_money') ?? accounts[0];
  const cashAccount = accounts.find((a) => a.type === 'cash' && a.id !== momoAccount?.id);
  const feeCategoryId = categories.find((c) => c.name === 'Bills')?.id ?? null;
  const importedRefs = useMemo(() => new Set(allTransactions.map((t) => t.notes).filter((n): n is string => !!n)), [allTransactions]);

  const read = () => {
    const messages = splitMessages(paste);
    setDrafts(
      messages.map((message, i) => {
        const parsed = parseMomoSms(message);
        const duplicate = !!parsed.fields.reference && importedRefs.has(referenceNote(parsed.fields.reference));
        return {
          key: `${i}-${parsed.fields.reference ?? message.length}`,
          parsed,
          include: parsed.ok && !duplicate,
          direction: parsed.fields.kind && INCOME_KINDS.includes(parsed.fields.kind) ? 'income' : 'expense',
          accountId: momoAccount?.id ?? null,
          categoryId: null,
          recordFee: (parsed.fields.fee ?? 0) > 0,
          duplicate,
        };
      }),
    );
    Haptics.selectionAsync();
  };

  const update = (key: string, patch: Partial<Draft>) => setDrafts((all) => all.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const selected = drafts.filter((d) => d.include && d.parsed.ok && d.accountId);

  const save = async () => {
    setIsSaving(true);
    for (const draft of selected) {
      for (const tx of toTransactions(draft, cashAccount?.id ?? null, feeCategoryId)) await transactionsRepository.createTransaction(tx);
    }
    await loadAll();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg pb-3xl" keyboardShouldPersistTaps="handled">
      <View className="gap-sm">
        <Label>Paste your MoMo or Orange Money messages</Label>
        <TextInput
          value={paste}
          onChangeText={setPaste}
          multiline
          textAlignVertical="top"
          placeholder={'e.g. "You have transferred 15,000 FCFA to …"\n\nLeave a blank line between messages.'}
          placeholderTextColor={colors['text-muted']}
          accessibilityLabel="Pasted SMS messages"
          className="min-h-[120px] rounded-md border border-border-strong bg-surface px-md py-md text-text-primary"
        />
        <Caption>Messages stay on this phone. Copy them from your SMS app, then paste here.</Caption>
        <Button label="Read messages" variant="secondary" onPress={read} disabled={!paste.trim()} />
      </View>

      {drafts.map((draft) => (
        <DraftCard
          key={draft.key}
          draft={draft}
          accounts={accounts}
          categories={categories}
          allTransactions={allTransactions}
          cashAccountName={cashAccount?.name ?? null}
          onChange={(patch) => update(draft.key, patch)}
        />
      ))}

      {drafts.length > 0 ? (
        <Button
          label={isSaving ? 'Saving…' : `Save ${selected.length} ${selected.length === 1 ? 'transaction' : 'transactions'}`}
          onPress={save}
          disabled={isSaving || selected.length === 0}
        />
      ) : null}
    </ScrollView>
  );
}

function DraftCard({
  draft,
  accounts,
  categories,
  allTransactions,
  cashAccountName,
  onChange,
}: {
  draft: Draft;
  accounts: ReturnType<typeof useFinanceStore.getState>['accounts'];
  categories: ReturnType<typeof useFinanceStore.getState>['categories'];
  allTransactions: Transaction[];
  cashAccountName: string | null;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const colors = useThemeColors();
  const { fields, ok, confidence } = draft.parsed;
  const account = accounts.find((a) => a.id === draft.accountId);
  const isWithdrawal = fields.kind === 'withdrawal';
  const relevantCategories = categories.filter((c) => c.type === draft.direction);
  const appBalance = account ? calculateBalance(account, allTransactions) : null;

  if (!ok) {
    return (
      <Card className="gap-xs">
        <Badge label="Not recognised" tone="warning" />
        <BodySmall numberOfLines={3}>{draft.parsed.raw}</BodySmall>
        <Caption>No amount in FCFA was found in this message, so it will be skipped.</Caption>
      </Card>
    );
  }

  return (
    <Card className="gap-md" style={{ opacity: draft.include ? 1 : 0.6 }}>
      <View className="flex-row items-start justify-between gap-md">
        <View className="flex-1 gap-xs">
          <View className="flex-row flex-wrap gap-xs">
            <Badge label={fields.kind ? KIND_LABELS[fields.kind] : 'Type unclear'} tone={fields.kind ? 'accent' : 'warning'} />
            {draft.duplicate ? <Badge label="Already imported" tone="neutral" /> : null}
            {confidence === 'low' ? <Badge label="Check details" tone="warning" /> : null}
          </View>
          <AmountText valueMinor={fields.amount ?? 0} currency={SMS_CURRENCY} size="md" tone={draft.direction === 'income' ? 'success' : 'primary'} />
          {fields.counterparty ? <Body numberOfLines={1}>{fields.counterparty}</Body> : null}
          <Caption>
            {fields.occurredAt ? new Date(fields.occurredAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'No date found: today will be used'}
            {fields.reference ? ` · Ref ${fields.reference}` : ''}
          </Caption>
        </View>
        <Pressable
          onPress={() => onChange({ include: !draft.include })}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: draft.include }}
          accessibilityLabel="Import this message"
          hitSlop={8}
          className="h-11 w-11 items-center justify-center"
        >
          <Ionicons name={draft.include ? 'checkbox' : 'square-outline'} size={24} color={draft.include ? colors.accent : colors['text-muted']} />
        </Pressable>
      </View>

      {draft.include ? (
        <>
          {isWithdrawal ? (
            <Caption>{cashAccountName ? `Recorded as a transfer from ${account?.name ?? 'MoMo'} to ${cashAccountName}.` : 'Recorded as an expense. Add a Cash account to record cash-outs as transfers.'}</Caption>
          ) : (
            <ChipGroup<Direction>
              options={[
                { id: 'expense', label: 'Money out' },
                { id: 'income', label: 'Money in' },
              ]}
              selectedId={draft.direction}
              onSelect={(direction) => onChange({ direction, categoryId: null })}
            />
          )}

          {accounts.length > 1 ? (
            <View className="gap-xs">
              <Caption>Account</Caption>
              <ChipGroup options={accounts.map((a) => ({ id: a.id, label: a.name }))} selectedId={draft.accountId} onSelect={(accountId) => onChange({ accountId })} />
            </View>
          ) : null}

          {!isWithdrawal || !cashAccountName ? (
            <View className="gap-xs">
              <Caption>Category</Caption>
              <ChipGroup options={relevantCategories.map((c) => ({ id: c.id, label: c.name }))} selectedId={draft.categoryId} onSelect={(categoryId) => onChange({ categoryId })} />
            </View>
          ) : null}

          {(fields.fee ?? 0) > 0 ? (
            <Pressable
              onPress={() => onChange({ recordFee: !draft.recordFee })}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: draft.recordFee }}
              className="min-h-[44px] flex-row items-center gap-sm"
            >
              <Ionicons name={draft.recordFee ? 'checkbox' : 'square-outline'} size={20} color={draft.recordFee ? colors.accent : colors['text-muted']} />
              <BodySmall>Also record the {formatMoney(fields.fee ?? 0, SMS_CURRENCY)} fee as an expense</BodySmall>
            </Pressable>
          ) : null}

          {fields.balance !== null && appBalance !== null && account?.currency === SMS_CURRENCY && fields.balance !== appBalance ? (
            <Caption className="text-warning">
              The SMS says your balance is {formatMoney(fields.balance, SMS_CURRENCY)}; F-AI shows {formatMoney(appBalance, SMS_CURRENCY)} for {account.name} before this import.
            </Caption>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

/** One SMS → its transaction, plus a separate fee expense when asked. */
function toTransactions(draft: Draft, cashAccountId: string | null, feeCategoryId: string | null): NewTransaction[] {
  const { fields } = draft.parsed;
  if (!draft.accountId || !fields.amount) return [];
  const notes = fields.reference ? referenceNote(fields.reference) : null;
  const occurredAt = fields.occurredAt ?? new Date().toISOString();
  const base = { accountId: draft.accountId, amountMinor: fields.amount, currency: SMS_CURRENCY, occurredAt, notes, source: 'import' as const, description: null };

  const main: NewTransaction =
    fields.kind === 'withdrawal' && cashAccountId
      ? { ...base, type: 'transfer', transferAccountId: cashAccountId, categoryId: null, merchant: null, description: 'Cash out' }
      : { ...base, type: draft.direction, transferAccountId: null, categoryId: draft.categoryId, merchant: fields.counterparty };

  const fee: NewTransaction[] =
    draft.recordFee && (fields.fee ?? 0) > 0
      ? [{ ...base, amountMinor: fields.fee ?? 0, type: 'expense', transferAccountId: null, categoryId: feeCategoryId, merchant: 'Mobile money fee', notes: notes ? `${notes} fee` : null }]
      : [];
  return [main, ...fee];
}
