import { useEffect, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Body, Button, Caption, ChipGroup, Label } from '@/components/ui';
import { DateField } from '@/components/ui/DateField';
import { recurringExpensesRepository, subscriptionsRepository } from '@/database/repositories';
import { useFinanceStore } from '@/store/financeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useThemeColors } from '@/constants/theme';
import { FREQUENCY_LABELS, nextOccurrence } from '@/features/bills/bills';
import { formatMoney, parseMoneyInput } from '@/utils/currency';
import { FormScrollView } from '@/components/keyboard/keyboard';
import { categoryLabel, useT } from '@/i18n';

type BillKind = 'bill' | 'subscription';
type BillFrequency = 'weekly' | 'monthly' | 'yearly';

const FREQUENCIES: Record<BillKind, BillFrequency[]> = {
  bill: ['weekly', 'monthly', 'yearly'],
  subscription: ['monthly', 'yearly'],
};

/**
 * Add a recurring bill (rent, electricity) or a subscription (TV, phone
 * plan), or edit one when opened with `?source=&id=` from the Bills page.
 * A bill can't switch between bill and subscription; stopping it keeps
 * its history.
 */
export default function NewBillScreen() {
  const params = useLocalSearchParams<{ source?: 'subscription' | 'recurring'; id?: string }>();
  const isEditing = Boolean(params.id && params.source);
  const colors = useThemeColors();
  const { t } = useT();
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

  const [isLoaded, setIsLoaded] = useState(!isEditing);

  // Edit mode: load the bill once and fill the form.
  useEffect(() => {
    if (!params.id || !params.source) return;
    let isCurrent = true;
    (async () => {
      if (params.source === 'subscription') {
        const sub = (await subscriptionsRepository.listSubscriptions(true)).find((s) => s.id === params.id);
        if (!isCurrent || !sub) return;
        setKind('subscription');
        setFrequency(sub.billingCycle);
        setName(sub.name);
        setAmountInput(formatMoney(sub.amountMinor, sub.currency, { showSymbol: false }));
        setCategoryId(sub.categoryId);
        if (sub.nextBillingAt) setNextDue(nextOccurrence(new Date(sub.nextBillingAt), sub.billingCycle) ?? new Date());
      } else {
        const rec = (await recurringExpensesRepository.listRecurringExpenses(true)).find((r) => r.id === params.id);
        if (!isCurrent || !rec) return;
        setKind('bill');
        setFrequency(rec.frequency === 'weekly' || rec.frequency === 'yearly' ? rec.frequency : 'monthly');
        setName(rec.name);
        setAmountInput(formatMoney(rec.amountMinor, rec.currency, { showSymbol: false }));
        setCategoryId(rec.categoryId);
        if (rec.nextDueAt) setNextDue(nextOccurrence(new Date(rec.nextDueAt), rec.frequency) ?? new Date());
      }
      setIsLoaded(true);
    })();
    return () => {
      isCurrent = false;
    };
  }, [params.id, params.source]);

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const stopTracking = () => {
    if (!params.id) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(t('bills.stopTitle', { name: name || t('bills.thisBill') }), t('bills.stopBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('bills.stop'),
        style: 'destructive',
        onPress: async () => {
          if (params.source === 'subscription') await subscriptionsRepository.setSubscriptionActive(params.id as string, false);
          else await recurringExpensesRepository.setRecurringExpenseActive(params.id as string, false);
          await loadAll();
          router.back();
        },
      },
    ]);
  };

  const handleSave = async () => {
    const amountMinor = parseMoneyInput(amountInput, currency);
    if (!name.trim()) {
      setError(t('bills.nameError'));
      Haptics.selectionAsync();
      return;
    }
    if (amountMinor === null || amountMinor <= 0) {
      setError(t('bills.amountError'));
      Haptics.selectionAsync();
      return;
    }

    setIsSaving(true);
    const common = { name: name.trim(), categoryId, amountMinor, currency };
    if (isEditing && params.id) {
      if (params.source === 'subscription') {
        await subscriptionsRepository.updateSubscription(params.id, { name: common.name, categoryId, amountMinor, billingCycle: frequency === 'yearly' ? 'yearly' : 'monthly', nextBillingAt: nextDue.toISOString() });
      } else {
        await recurringExpensesRepository.updateRecurringExpense(params.id, { name: common.name, categoryId, amountMinor, frequency, nextDueAt: nextDue.toISOString() });
      }
    } else if (kind === 'subscription') {
      await subscriptionsRepository.createSubscription({ ...common, billingCycle: frequency === 'yearly' ? 'yearly' : 'monthly', nextBillingAt: nextDue.toISOString() });
    } else {
      await recurringExpensesRepository.createRecurringExpense({ ...common, frequency, nextDueAt: nextDue.toISOString() });
    }
    await loadAll(); // recomputes upcoming obligations and safe-to-spend
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <FormScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg pb-3xl">
      <Stack.Screen options={{ title: isEditing ? (kind === 'subscription' ? t('bills.editSubscription') : t('bills.editBill')) : t('nav.addBill') }} />
      {isLoaded ? null : <Caption>{t('common.loading')}</Caption>}
      <View className={isEditing ? 'hidden' : 'gap-sm'}>
        <Label>{t('bills.type')}</Label>
        <ChipGroup<BillKind>
          options={[
            { id: 'bill', label: t('bills.kindBill') },
            { id: 'subscription', label: t('bills.kindSubscription') },
          ]}
          selectedId={kind}
          onSelect={(next) => {
            setKind(next);
            if (!FREQUENCIES[next].includes(frequency)) setFrequency('monthly');
          }}
        />
      </View>

      <View className="gap-sm">
        <Label>{t('bills.name')}</Label>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={kind === 'bill' ? t('bills.billPlaceholder') : t('bills.subscriptionPlaceholder')}
          placeholderTextColor={colors['text-muted']}
          className="rounded-md border border-border-strong bg-surface px-md py-md text-text-primary"
        />
      </View>

      <View className="gap-sm">
        <Label>{t('bills.amount', { currency })}</Label>
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
        <Label>{t('bills.howOften')}</Label>
        <ChipGroup<BillFrequency> options={FREQUENCIES[kind].map((f) => ({ id: f, label: FREQUENCY_LABELS[f] }))} selectedId={frequency} onSelect={setFrequency} />
      </View>

      <DateField label={t('bills.nextDue')} value={nextDue} onChange={setNextDue} minimumDate={new Date()} />

      <View className="gap-sm">
        <Label>{t('bills.category')}</Label>
        <ChipGroup options={expenseCategories.map((c) => ({ id: c.id, label: categoryLabel(c.name) }))} selectedId={categoryId} onSelect={setCategoryId} />
      </View>

      {error ? <Caption className="text-danger">{error}</Caption> : null}

      <Button label={isSaving ? t('common.saving') : kind === 'bill' ? t('bills.saveBill') : t('bills.saveSubscription')} className="mt-sm" onPress={handleSave} disabled={isSaving || !isLoaded} />

      {isEditing ? (
        <Pressable onPress={stopTracking} accessibilityRole="button" className="items-center py-md">
          <Body className="text-danger">{t('bills.stop')}</Body>
        </Pressable>
      ) : null}
    </FormScrollView>
  );
}
