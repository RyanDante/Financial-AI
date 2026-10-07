import { useState } from 'react';
import { TextInput, View } from 'react-native';
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
import { FormScrollView } from '@/components/keyboard/keyboard';
import { useT } from '@/i18n';

type IncomeFrequency = 'weekly' | 'monthly' | 'yearly';
const FREQUENCIES: IncomeFrequency[] = ['monthly', 'weekly', 'yearly'];

/** Add a salary or other regular income, with the next date it arrives. */
export default function NewIncomeScreen() {
  const colors = useThemeColors();
  const { t } = useT();
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
      setError(t('income.nameError'));
      Haptics.selectionAsync();
      return;
    }
    if (amountMinor === null || amountMinor <= 0) {
      setError(t('income.amountError'));
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
    <FormScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg pb-3xl">
      <View className="gap-sm">
        <Label>{t('income.name')}</Label>
        <TextInput
          value={source}
          onChangeText={setSource}
          placeholder={t('income.namePlaceholder')}
          placeholderTextColor={colors['text-muted']}
          className="rounded-md border border-border-strong bg-surface px-md py-md text-text-primary"
        />
      </View>

      <View className="gap-sm">
        <Label>{t('income.amount', { currency })}</Label>
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
        <Label>{t('income.howOften')}</Label>
        <ChipGroup<IncomeFrequency> options={FREQUENCIES.map((f) => ({ id: f, label: FREQUENCY_LABELS[f] }))} selectedId={frequency} onSelect={setFrequency} />
      </View>

      <View className="gap-sm">
        <DateField label={t('income.nextPaydayField')} value={nextExpected} onChange={setNextExpected} minimumDate={new Date()} />
        <Caption>{t('income.nextPaydayHint')}</Caption>
      </View>

      {accounts.length > 1 ? (
        <View className="gap-sm">
          <Label>{t('income.paidInto')}</Label>
          <ChipGroup options={accounts.map((a) => ({ id: a.id, label: a.name }))} selectedId={accountId} onSelect={setAccountId} />
        </View>
      ) : null}

      {error ? <Caption className="text-danger">{error}</Caption> : null}
      <Button label={isSaving ? t('common.saving') : t('income.save')} className="mt-sm" onPress={handleSave} disabled={isSaving} />
    </FormScrollView>
  );
}
