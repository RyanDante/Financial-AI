import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Button, Caption, ChipGroup, Label } from '@/components/ui';
import { DateField } from '@/components/ui/DateField';
import { incomeRepository } from '@/database/repositories';
import { useFinanceStore } from '@/store/financeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useThemeColors } from '@/constants/theme';
import { FREQUENCY_LABELS } from '@/features/bills/bills';
import { parseMoneyInput } from '@/utils/currency';

type IncomeFrequency = 'weekly' | 'monthly' | 'yearly';
const FREQUENCIES: IncomeFrequency[] = ['monthly', 'weekly', 'yearly'];

/** Add a salary or other regular income, with the next date it arrives. */
export default function NewIncomeScreen() {
  const colors = useThemeColors();
  const { accounts, loadAll } = useFinanceStore();
  const currency = useSettingsStore((s) => s.defaultCurrency);
  const [source, setSource] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [frequency, setFrequency] = useState<IncomeFrequency>('monthly');
  const [nextExpected, setNextExpected] = useState(new Date());
  const [accountId, setAccountId] = useState<string | null>(accounts[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const amountMinor = parseMoneyInput(amountInput, currency);
    if (!source.trim()) {
      setError('Name it, e.g. "Salary".');
      Haptics.selectionAsync();
      return;
    }
    if (amountMinor === null || amountMinor <= 0) {
      setError('Enter an amount greater than 0.');
      Haptics.selectionAsync();
      return;
    }
    setIsSaving(true);
    await incomeRepository.createIncomeSource({ source: source.trim(), amountMinor, currency, frequency, nextExpectedAt: nextExpected.toISOString(), accountId });
    await loadAll();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg pb-3xl" keyboardShouldPersistTaps="handled">
      <View className="gap-sm">
        <Label>Name</Label>
        <TextInput
          value={source}
          onChangeText={setSource}
          placeholder="e.g. Salary, Shop income"
          placeholderTextColor={colors['text-muted']}
          className="rounded-md border border-border-strong bg-surface px-md py-md text-text-primary"
        />
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
        <Label>How often</Label>
        <ChipGroup<IncomeFrequency> options={FREQUENCIES.map((f) => ({ id: f, label: FREQUENCY_LABELS[f] }))} selectedId={frequency} onSelect={setFrequency} />
      </View>

      <View className="gap-sm">
        <DateField label="Next payday" value={nextExpected} onChange={setNextExpected} minimumDate={new Date()} />
        <Caption>Used to work out how much you can spend each day until then.</Caption>
      </View>

      {accounts.length > 1 ? (
        <View className="gap-sm">
          <Label>Paid into</Label>
          <ChipGroup options={accounts.map((a) => ({ id: a.id, label: a.name }))} selectedId={accountId} onSelect={setAccountId} />
        </View>
      ) : null}

      {error ? <Caption className="text-danger">{error}</Caption> : null}
      <Button label={isSaving ? 'Saving…' : 'Save income'} className="mt-sm" onPress={handleSave} disabled={isSaving} />
    </ScrollView>
  );
}
