import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Button, Caption, ChipGroup, Label } from '@/components/ui';
import { DateField } from '@/components/ui/DateField';
import { recurringExpensesRepository, subscriptionsRepository } from '@/database/repositories';
import { useFinanceStore } from '@/store/financeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useThemeColors } from '@/constants/theme';
import { FREQUENCY_LABELS } from '@/features/bills/bills';
import { parseMoneyInput } from '@/utils/currency';

type BillKind = 'bill' | 'subscription';
type BillFrequency = 'weekly' | 'monthly' | 'yearly';

const FREQUENCIES: Record<BillKind, BillFrequency[]> = {
  bill: ['weekly', 'monthly', 'yearly'],
  subscription: ['monthly', 'yearly'],
};

/** Add a recurring bill (rent, electricity) or a subscription (TV, phone plan). */
export default function NewBillScreen() {
  const colors = useThemeColors();
  const categories = useFinanceStore((s) => s.categories);
  const loadAll = useFinanceStore((s) => s.loadAll);
  const currency = useSettingsStore((s) => s.defaultCurrency);
  const [kind, setKind] = useState<BillKind>('bill');
  const [frequency, setFrequency] = useState<BillFrequency>('monthly');
  const [name, setName] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(categories.find((c) => c.name === 'Bills')?.id ?? null);
  const [nextDue, setNextDue] = useState(new Date());
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const handleSave = async () => {
    const amountMinor = parseMoneyInput(amountInput, currency);
    if (!name.trim()) {
      setError('Give it a name, e.g. "Rent" or "Canal+".');
      Haptics.selectionAsync();
      return;
    }
    if (amountMinor === null || amountMinor <= 0) {
      setError('Enter an amount greater than 0.');
      Haptics.selectionAsync();
      return;
    }

    setIsSaving(true);
    const common = { name: name.trim(), categoryId, amountMinor, currency };
    if (kind === 'subscription') {
      await subscriptionsRepository.createSubscription({ ...common, billingCycle: frequency === 'yearly' ? 'yearly' : 'monthly', nextBillingAt: nextDue.toISOString() });
    } else {
      await recurringExpensesRepository.createRecurringExpense({ ...common, frequency, nextDueAt: nextDue.toISOString() });
    }
    await loadAll(); // recomputes upcoming obligations and safe-to-spend
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg pb-3xl" keyboardShouldPersistTaps="handled">
      <View className="gap-sm">
        <Label>Type</Label>
        <ChipGroup<BillKind>
          options={[
            { id: 'bill', label: 'Bill' },
            { id: 'subscription', label: 'Subscription' },
          ]}
          selectedId={kind}
          onSelect={(next) => {
            setKind(next);
            if (!FREQUENCIES[next].includes(frequency)) setFrequency('monthly');
          }}
        />
      </View>

      <View className="gap-sm">
        <Label>Name</Label>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={kind === 'bill' ? 'e.g. Rent, ENEO electricity' : 'e.g. Canal+, MTN data plan'}
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
        <ChipGroup<BillFrequency> options={FREQUENCIES[kind].map((f) => ({ id: f, label: FREQUENCY_LABELS[f] }))} selectedId={frequency} onSelect={setFrequency} />
      </View>

      <DateField label="Next due" value={nextDue} onChange={setNextDue} minimumDate={new Date()} />

      <View className="gap-sm">
        <Label>Category (optional)</Label>
        <ChipGroup options={expenseCategories.map((c) => ({ id: c.id, label: c.name }))} selectedId={categoryId} onSelect={setCategoryId} />
      </View>

      {error ? <Caption className="text-danger">{error}</Caption> : null}

      <Button label={isSaving ? 'Saving…' : kind === 'bill' ? 'Save bill' : 'Save subscription'} className="mt-sm" onPress={handleSave} disabled={isSaving} />
    </ScrollView>
  );
}
