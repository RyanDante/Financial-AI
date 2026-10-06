import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Body, Button, Caption, Label } from '@/components/ui';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { DateField } from '@/components/ui/DateField';
import { transactionsRepository } from '@/database/repositories';
import { useFinanceStore } from '@/store/financeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { formatMoney, parseMoneyInput } from '@/utils/currency';
import { cn } from '@/utils/cn';
import type { Transaction, TransactionType } from '@/types/finance';
import { useThemeColors } from '@/constants/theme';

/**
 * Add a transaction, or edit one when opened with `?id=` (from the
 * transaction detail screen). Editing keeps the original currency and
 * source; everything else, including the date, can change. A transfer moves
 * money between two of your accounts: it changes both balances but is not
 * spending or income, so it has no category.
 */
const TYPE_LABELS: Record<TransactionType, string> = { expense: 'Expense', income: 'Income', transfer: 'Transfer' };

export default function NewTransactionScreen() {
  // `id` opens the form in edit mode; `categoryId`/`merchant` prefill a new expense (from Home's suggestions).
  const { id, categoryId: prefillCategoryId, merchant: prefillMerchant } = useLocalSearchParams<{ id?: string; categoryId?: string; merchant?: string }>();
  const isEditing = Boolean(id);
  const colors = useThemeColors();
  const { accounts, categories, addTransaction, updateTransaction } = useFinanceStore();
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency);
  const [existing, setExisting] = useState<Transaction | null>(null);
  const [type, setType] = useState<TransactionType>('expense');
  const [amountInput, setAmountInput] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(prefillCategoryId ?? null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [transferAccountId, setTransferAccountId] = useState<string | null>(null);
  const [occurredAt, setOccurredAt] = useState(new Date());
  const [merchant, setMerchant] = useState(prefillMerchant ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let isCurrent = true;
    (async () => {
      const tx = await transactionsRepository.getTransactionById(id);
      if (!isCurrent || !tx) return;
      setExisting(tx);
      setType(tx.type);
      // formatMoney without a symbol gives "12,500" / "1,500.50", which parseMoneyInput reads back.
      setAmountInput(formatMoney(tx.amountMinor, tx.currency, { showSymbol: false }));
      setCategoryId(tx.categoryId);
      setAccountId(tx.accountId);
      setTransferAccountId(tx.transferAccountId);
      setOccurredAt(new Date(tx.occurredAt));
      setMerchant(tx.merchant ?? '');
    })();
    return () => {
      isCurrent = false;
    };
  }, [id]);

  const currency = existing?.currency ?? defaultCurrency;
  const relevantCategories = categories.filter((c) => c.type === (type === 'income' ? 'income' : 'expense'));
  const selectedAccountId = accountId ?? accounts[0]?.id ?? null;
  const isTransfer = type === 'transfer';
  const types: TransactionType[] = accounts.length > 1 || isTransfer ? ['expense', 'income', 'transfer'] : ['expense', 'income'];
  const accountName = (accountIdToFind: string | null) => accounts.find((a) => a.id === accountIdToFind)?.name ?? 'account';

  const handleSave = async () => {
    const amountMinor = parseMoneyInput(amountInput, currency);
    if (amountMinor === null || amountMinor <= 0) {
      setError('Enter an amount greater than 0.');
      return;
    }
    if (!selectedAccountId) {
      setError('Add an account in Settings first.');
      return;
    }
    if (isTransfer && (!transferAccountId || transferAccountId === selectedAccountId)) {
      setError('Choose a different account to move the money to.');
      return;
    }

    setIsSaving(true);
    const fields = {
      accountId: selectedAccountId,
      transferAccountId: isTransfer ? transferAccountId : null,
      categoryId: isTransfer ? null : categoryId,
      amountMinor,
      type,
      merchant: isTransfer ? null : merchant.trim() || null,
      description: isTransfer ? `${accountName(selectedAccountId)} → ${accountName(transferAccountId)}` : (existing?.description ?? null),
      occurredAt: occurredAt.toISOString(),
    };
    if (isEditing && id) {
      await updateTransaction(id, fields);
    } else {
      await addTransaction({ ...fields, currency, notes: null, source: 'manual' });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  if (isEditing && !existing) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Caption>Loading…</Caption>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg" keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isEditing ? 'Edit transaction' : 'Add transaction' }} />

      <View className="flex-row gap-sm">
        {types.map((t) => (
          <Pressable
            key={t}
            onPress={() => {
              setType(t);
              setCategoryId(null);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: type === t }}
            className={cn('flex-1 items-center rounded-md border py-md', type === t ? 'border-accent bg-accent-muted' : 'border-border bg-surface')}
          >
            <Body className={type === t ? 'text-accent-secondary' : undefined}>{TYPE_LABELS[t]}</Body>
          </Pressable>
        ))}
      </View>

      <View className="gap-sm">
        <Label>Amount ({currency})</Label>
        <TextInput
          value={amountInput}
          onChangeText={setAmountInput}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors['text-muted']}
          className="rounded-md border border-border-strong bg-surface px-md py-md text-[22px] text-text-primary"
        />
      </View>

      {accounts.length > 1 ? (
        <View className="gap-sm">
          <Label>{isTransfer ? 'From' : 'Account'}</Label>
          <ChipGroup options={accounts.map((a) => ({ id: a.id, label: a.name }))} selectedId={selectedAccountId} onSelect={setAccountId} />
        </View>
      ) : null}

      {isTransfer ? (
        <View className="gap-sm">
          <Label>To</Label>
          <ChipGroup
            options={accounts.filter((a) => a.id !== selectedAccountId).map((a) => ({ id: a.id, label: a.name }))}
            selectedId={transferAccountId}
            onSelect={setTransferAccountId}
          />
          <Caption>Moves money between your accounts. It isn&rsquo;t counted as spending or income.</Caption>
        </View>
      ) : (
        <>
          <View className="gap-sm">
            <Label>Category</Label>
            <ChipGroup options={relevantCategories.map((c) => ({ id: c.id, label: c.name }))} selectedId={categoryId} onSelect={setCategoryId} />
          </View>

          <View className="gap-sm">
            <Label>Merchant / note (optional)</Label>
            <TextInput
              value={merchant}
              onChangeText={setMerchant}
              placeholder="e.g. Market, Landlord, Employer"
              placeholderTextColor={colors['text-muted']}
              className="rounded-md border border-border-strong bg-surface px-md py-md text-text-primary"
            />
          </View>
        </>
      )}

      <DateField label="Date" value={occurredAt} onChange={setOccurredAt} maximumDate={new Date()} />

      {error ? <Caption className="text-danger">{error}</Caption> : null}

      <Button label={isSaving ? 'Saving…' : 'Save transaction'} className="mt-sm" onPress={handleSave} disabled={isSaving} />
    </ScrollView>
  );
}
