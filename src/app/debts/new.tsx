import { useState } from 'react';
import { TextInput, View } from 'react-native';
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
import { FormScrollView } from '@/components/keyboard/keyboard';
import { useT } from '@/i18n';

/** Add money the user owes (a loan, credit) or money they lent someone. */
export default function NewDebtScreen() {
  const colors = useThemeColors();
  const { t } = useT();
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
    if (!counterparty.trim()) return fail(isOwed ? t('debts.whoOwesYou') : t('debts.whoYouOwe'));
    if (amountMinor === null || amountMinor <= 0) return fail(t('debts.amountError'));
    if (paymentMinor === null || paymentMinor < 0) return fail(t('debts.paymentError'));
    if (dueDay !== null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) return fail(t('debts.dueDayError'));

    setIsSaving(true);
    await debtsRepository.createDebt({
      name: name.trim() || (isOwed ? t('debts.defaultLent') : t('debts.defaultLoan')),
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
    <FormScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg pb-3xl">
      <ChipGroup<DebtDirection>
        options={[
          { id: 'i_owe', label: t('debts.iOwe') },
          { id: 'owed_to_me', label: t('debts.someoneOwesMe') },
        ]}
        selectedId={direction}
        onSelect={setDirection}
      />

      <Field label={isOwed ? t('debts.whoOwesLabel') : t('debts.whoYouOweLabel')} value={counterparty} onChange={setCounterparty} placeholder={isOwed ? t('debts.owesPlaceholder') : t('debts.owePlaceholder')} colors={colors} />
      <Field label={t('debts.whatFor')} value={name} onChange={setName} placeholder={isOwed ? t('debts.lentPlaceholder') : t('debts.loanPlaceholder')} colors={colors} />
      <Field label={t('debts.amount', { currency })} value={amountInput} onChange={setAmountInput} placeholder="0" colors={colors} numeric large />
      <Field label={t('debts.monthlyPayment')} value={paymentInput} onChange={setPaymentInput} placeholder="0" colors={colors} numeric />
      <View className="gap-sm">
        <Field label={t('debts.dueDay')} value={dueDayInput} onChange={setDueDayInput} placeholder={t('debts.dueDayPlaceholder')} colors={colors} numeric />
        <Caption>{t('debts.dueDayHint')}</Caption>
      </View>

      {error ? <Caption className="text-danger">{error}</Caption> : null}
      <Button label={isSaving ? t('common.saving') : t('debts.save')} className="mt-sm" onPress={handleSave} disabled={isSaving} />
    </FormScrollView>
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
