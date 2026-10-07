import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AmountText, Body, BodySmall, Button, Caption, Card, ChipGroup, EmptyState, Label, Overline } from '@/components/ui';
import { debtsRepository, transactionsRepository } from '@/database/repositories';
import { useDebts } from '@/features/debts/useDebts';
import { useFinanceStore } from '@/store/financeStore';
import { useThemeColors } from '@/constants/theme';
import { formatMoney, parseMoneyInput } from '@/utils/currency';
import { FormScrollView } from '@/components/keyboard/keyboard';
import { useT } from '@/i18n';

/**
 * Record a repayment on a debt (either direction), optionally also logging
 * it as a transaction so account balances stay right: paying back is
 * money out, being paid back is money in. Also where a debt is removed.
 */
export default function PayDebtScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const { t } = useT();
  const debt = useDebts().find((d) => d.id === id);
  const { accounts, loadAll } = useFinanceStore();
  const [amountInput, setAmountInput] = useState('');
  const [logTransaction, setLogTransaction] = useState(true);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!debt) {
    return (
      <View className="flex-1 bg-background">
        <EmptyState icon="people-outline" title={t('pay.notFound')} description={t('pay.notFoundHint')} />
      </View>
    );
  }

  const isOwed = debt.direction === 'owed_to_me';
  const who = debt.counterparty ?? debt.name;
  const selectedAccountId = accountId ?? accounts[0]?.id ?? null;
  const suggestedMinor = debt.minimumPaymentMinor > 0 ? Math.min(debt.minimumPaymentMinor, debt.remainingMinor) : debt.remainingMinor;

  const handleSave = async () => {
    const amountMinor = amountInput.trim() ? parseMoneyInput(amountInput, debt.currency) : suggestedMinor;
    if (amountMinor === null || amountMinor <= 0) {
      setError(t('pay.amountError'));
      Haptics.selectionAsync();
      return;
    }
    if (amountMinor > debt.remainingMinor) {
      setError(t('pay.onlyLeft', { amount: formatMoney(debt.remainingMinor, debt.currency) }));
      Haptics.selectionAsync();
      return;
    }
    setIsSaving(true);
    await debtsRepository.recordDebtPayment(debt.id, amountMinor);
    if (logTransaction && selectedAccountId) {
      await transactionsRepository.createTransaction({
        accountId: selectedAccountId,
        categoryId: null,
        transferAccountId: null,
        amountMinor,
        currency: debt.currency,
        type: isOwed ? 'income' : 'expense',
        merchant: who,
        description: isOwed ? t('pay.repaymentFrom', { who }) : t('pay.repaymentTo', { who }),
        notes: null,
        occurredAt: new Date().toISOString(),
        source: 'manual',
      });
    }
    await loadAll();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(t('pay.removeTitle', { name: debt.name }), t('pay.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('pay.remove'),
        style: 'destructive',
        onPress: async () => {
          await debtsRepository.deleteDebt(debt.id);
          await loadAll();
          router.back();
        },
      },
    ]);
  };

  return (
    <FormScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg pb-3xl">
      <Stack.Screen options={{ title: isOwed ? t('pay.titleReceived') : t('nav.recordPayment') }} />

      <Card className="gap-xs">
        <Overline>{isOwed ? t('pay.stillOwesYou', { who }) : t('pay.youStillOwe', { who })}</Overline>
        <AmountText valueMinor={debt.remainingMinor} currency={debt.currency} size="lg" />
        <Caption>
          {t('pay.originally', { name: debt.name, amount: formatMoney(debt.principalMinor, debt.currency) })}
        </Caption>
      </Card>

      {debt.remainingMinor > 0 ? (
        <>
          <View className="gap-sm">
            <Label>{t('pay.amount', { currency: debt.currency })}</Label>
            <TextInput
              value={amountInput}
              onChangeText={setAmountInput}
              keyboardType="decimal-pad"
              placeholder={formatMoney(suggestedMinor, debt.currency, { showSymbol: false })}
              placeholderTextColor={colors['text-muted']}
              accessibilityLabel={t('pay.amountA11y', { currency: debt.currency })}
              className="rounded-md border border-border-strong bg-surface px-md py-md text-[22px] text-text-primary"
            />
            <Caption>{t('pay.leaveEmpty', { amount: formatMoney(suggestedMinor, debt.currency) })}</Caption>
          </View>

          <Pressable
            onPress={() => setLogTransaction((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: logTransaction }}
            className="min-h-[44px] flex-row items-center gap-sm"
          >
            <Ionicons name={logTransaction ? 'checkbox' : 'square-outline'} size={20} color={logTransaction ? colors.accent : colors['text-muted']} />
            <BodySmall>{isOwed ? t('pay.alsoRecordIn') : t('pay.alsoRecordOut')}</BodySmall>
          </Pressable>
          {logTransaction && accounts.length > 1 ? (
            <ChipGroup options={accounts.map((a) => ({ id: a.id, label: a.name }))} selectedId={selectedAccountId} onSelect={setAccountId} />
          ) : null}

          {error ? <Caption className="text-danger">{error}</Caption> : null}
          <Button label={isSaving ? t('common.saving') : t('pay.save')} onPress={handleSave} disabled={isSaving} />
        </>
      ) : (
        <Body className="text-success">{t('pay.settled')}</Body>
      )}

      <Pressable onPress={handleDelete} accessibilityRole="button" className="items-center py-md">
        <Body className="text-danger">{t('pay.removeDebt')}</Body>
      </Pressable>
    </FormScrollView>
  );
}
