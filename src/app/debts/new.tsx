import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Button, Caption, ChipGroup, Label } from '@/components/ui';
import { debtsRepository } from '@/database/repositories';
import { useFinanceStore } from '@/store/financeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useThemeColors } from '@/constants/theme';
import { parseMoneyInput } from '@/utils/currency';
import { cn } from '@/utils/cn';
import type { DebtDirection } from '@/types/finance';

/** Add money the user owes (a loan, credit) or money they lent someone. */
export default function NewDebtScreen() {
  const colors = useThemeColors();
  const loadAll = useFinanceStore((s) => s.loadAll);
  const currency = useSettingsStore((s) => s.defaultCurrency);
  const [direction, setDirection] = useState<DebtDirection>('i_owe');
  const [counterparty, setCounterparty] = useState('');
  const [name, setName] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [paymentInput, setPaymentInput] = useState('');
  const [dueDayInput, setDueDayInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isOwed = direction === 'owed_to_me';

  const handleSave = async () => {
    const amountMinor = parseMoneyInput(amountInput, currency);
    const paymentMinor = paymentInput.trim() ? parseMoneyInput(paymentInput, currency) : 0;
    const dueDay = dueDayInput.trim() ? Number(dueDayInput) : null;
    const fail = (message: string) => {
      setError(message);
      Haptics.selectionAsync();
    };
    if (!counterparty.trim()) return fail(isOwed ? 'Who owes you this money?' : 'Who do you owe this money to?');
    if (amountMinor === null || amountMinor <= 0) return fail('Enter an amount greater than 0.');
    if (paymentMinor === null || paymentMinor < 0) return fail('Enter the monthly payment as a number, or leave it empty.');
    if (dueDay !== null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) return fail('The due day is a day of the month, from 1 to 31.');

    setIsSaving(true);
    await debtsRepository.createDebt({
      name: name.trim() || (isOwed ? 'Money lent' : 'Loan'),
      direction,
      counterparty: counterparty.trim(),
      principalMinor: amountMinor,
      remainingMinor: amountMinor,
      currency,
      minimumPaymentMinor: paymentMinor,
      dueDayOfMonth: dueDay,
    });
    await loadAll();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg pb-3xl" keyboardShouldPersistTaps="handled">
      <ChipGroup<DebtDirection>
        options={[
          { id: 'i_owe', label: 'I owe' },
          { id: 'owed_to_me', label: 'Someone owes me' },
        ]}
        selectedId={direction}
        onSelect={setDirection}
      />

      <Field label={isOwed ? 'Who owes you' : 'Who you owe'} value={counterparty} onChange={setCounterparty} placeholder={isOwed ? 'e.g. Paul, my cousin' : 'e.g. Afriland, Aunt Marie'} colors={colors} />
      <Field label="What for (optional)" value={name} onChange={setName} placeholder={isOwed ? 'e.g. School fees loan' : 'e.g. Phone loan'} colors={colors} />
      <Field label={`Amount (${currency})`} value={amountInput} onChange={setAmountInput} placeholder="0" colors={colors} numeric large />
      <Field label="Monthly payment (optional)" value={paymentInput} onChange={setPaymentInput} placeholder="0" colors={colors} numeric />
      <View className="gap-sm">
        <Field label="Due day each month (optional)" value={dueDayInput} onChange={setDueDayInput} placeholder="e.g. 25" colors={colors} numeric />
        <Caption>With a due day, F-AI reminds you 3 days before in Alerts.</Caption>
      </View>

      {error ? <Caption className="text-danger">{error}</Caption> : null}
      <Button label={isSaving ? 'Saving…' : 'Save debt'} className="mt-sm" onPress={handleSave} disabled={isSaving} />
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  colors,
  numeric,
  large,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  colors: ReturnType<typeof useThemeColors>;
  numeric?: boolean;
  large?: boolean;
}) {
  return (
    <View className="gap-sm">
      <Label>{label}</Label>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors['text-muted']}
        keyboardType={numeric ? 'number-pad' : 'default'}
        accessibilityLabel={label}
        className={cn('rounded-md border border-border-strong bg-surface px-md py-md text-text-primary', large && 'text-[22px]')}
      />
    </View>
  );
}
