import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Body, Button, Caption, Heading, Label } from '@/components/ui';
import { transactionsRepository } from '@/database/repositories';
import { useFinanceStore } from '@/store/financeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { formatMoney, parseMoneyInput } from '@/utils/currency';
import { cn } from '@/utils/cn';
import type { Transaction, TransactionType } from '@/types/finance';
import { useThemeColors } from '@/constants/theme';

/**
 * Add a transaction, or edit one when opened with `?id=` (from the
 * transaction detail screen). Editing keeps the original date, currency and
 * source; everything else on the form can change.
 */
export default function NewTransactionScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = Boolean(id);
  const colors = useThemeColors();
  const { accounts, categories, addTransaction, updateTransaction } = useFinanceStore();
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency);
  const [existing, setExisting] = useState<Transaction | null>(null);
  const [type, setType] = useState<TransactionType>('expense');
  const [amountInput, setAmountInput] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [merchant, setMerchant] = useState('');
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
      setMerchant(tx.merchant ?? '');
    })();
    return () => {
      isCurrent = false;
    };
  }, [id]);

  const currency = existing?.currency ?? defaultCurrency;
  const relevantCategories = categories.filter((c) => c.type === (type === 'income' ? 'income' : 'expense'));
  const selectedAccountId = accountId ?? accounts[0]?.id ?? null;

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

    setIsSaving(true);
    const fields = {
      accountId: selectedAccountId,
      categoryId,
      amountMinor,
      type,
      merchant: merchant.trim() || null,
    };
    if (isEditing && id) {
      await updateTransaction(id, fields);
    } else {
      await addTransaction({
        ...fields,
        transferAccountId: null,
        currency,
        description: null,
        notes: null,
        occurredAt: new Date().toISOString(),
        source: 'manual',
      });
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
      <Heading>{isEditing ? 'Edit transaction' : 'Add transaction'}</Heading>

      <View className="flex-row gap-sm">
        {(['expense', 'income'] as const).map((t) => (
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
            <Body className={type === t ? 'text-accent-secondary' : undefined}>{t === 'expense' ? 'Expense' : 'Income'}</Body>
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
          <Label>Account</Label>
          <ChipRow
            options={accounts.map((a) => ({ id: a.id, label: a.name }))}
            selectedId={selectedAccountId}
            onSelect={setAccountId}
          />
        </View>
      ) : null}

      <View className="gap-sm">
        <Label>Category</Label>
        <ChipRow options={relevantCategories.map((c) => ({ id: c.id, label: c.name }))} selectedId={categoryId} onSelect={setCategoryId} />
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

      {error ? <Caption className="text-danger">{error}</Caption> : null}

      <View className="flex-row gap-sm pt-sm">
        <Button label="Cancel" variant="secondary" className="flex-1" onPress={() => router.back()} />
        <Button label={isSaving ? 'Saving…' : 'Save'} className="flex-1" onPress={handleSave} disabled={isSaving} />
      </View>
    </ScrollView>
  );
}

function ChipRow({ options, selectedId, onSelect }: { options: { id: string; label: string }[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <View className="flex-row flex-wrap gap-sm">
      {options.map((option) => {
        const isSelected = option.id === selectedId;
        return (
          <Pressable
            key={option.id}
            onPress={() => onSelect(option.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            className={cn('rounded-sm border px-md py-sm', isSelected ? 'border-accent bg-accent-muted' : 'border-border bg-surface')}
          >
            <Label className={isSelected ? 'text-accent-secondary' : undefined}>{option.label}</Label>
          </Pressable>
        );
      })}
    </View>
  );
}
