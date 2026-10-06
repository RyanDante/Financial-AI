import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Body, Button, Caption, Heading, Label } from '@/components/ui';
import { useFinanceStore } from '@/store/financeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { parseMoneyInput } from '@/utils/currency';
import { cn } from '@/utils/cn';
import type { TransactionType } from '@/types/finance';
import { useThemeColors } from '@/constants/theme';

export default function NewTransactionScreen() {
  const colors = useThemeColors();
  const { accounts, categories, addTransaction } = useFinanceStore();
  const currency = useSettingsStore((s) => s.defaultCurrency);
  const [type, setType] = useState<TransactionType>('expense');
  const [amountInput, setAmountInput] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [merchant, setMerchant] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const relevantCategories = categories.filter((c) => c.type === (type === 'income' ? 'income' : 'expense'));
  const defaultAccount = accounts[0];

  const handleSave = async () => {
    const amountMinor = parseMoneyInput(amountInput, currency);
    if (amountMinor === null || amountMinor <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    if (!defaultAccount) {
      setError('No account available.');
      return;
    }

    setIsSaving(true);
    await addTransaction({
      accountId: defaultAccount.id,
      categoryId,
      transferAccountId: null,
      amountMinor,
      currency,
      type,
      merchant: merchant.trim() || null,
      description: null,
      notes: null,
      occurredAt: new Date().toISOString(),
      source: 'manual',
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg">
      <Heading>Add transaction</Heading>

      <View className="flex-row gap-sm">
        {(['expense', 'income'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => {
              setType(t);
              setCategoryId(null);
            }}
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

      <View className="gap-sm">
        <Label>Category</Label>
        <View className="flex-row flex-wrap gap-sm">
          {relevantCategories.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => setCategoryId(category.id)}
              className={cn(
                'rounded-sm border px-md py-sm',
                categoryId === category.id ? 'border-accent bg-accent-muted' : 'border-border bg-surface',
              )}
            >
              <Label className={categoryId === category.id ? 'text-accent-secondary' : undefined}>{category.name}</Label>
            </Pressable>
          ))}
        </View>
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
