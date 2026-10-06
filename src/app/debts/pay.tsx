import { useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AmountText, Body, BodySmall, Button, Caption, Card, ChipGroup, EmptyState, Label, Overline } from '@/components/ui';
import { debtsRepository, transactionsRepository } from '@/database/repositories';
import { useDebts } from '@/features/debts/useDebts';
import { useFinanceStore } from '@/store/financeStore';
import { useThemeColors } from '@/constants/theme';
import { formatMoney, parseMoneyInput } from '@/utils/currency';

/**
 * Record a repayment on a debt (either direction), optionally also logging
 * it as a transaction so account balances stay right: paying back is
 * money out, being paid back is money in. Also where a debt is removed.
 */
export default function PayDebtScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
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
        <EmptyState icon="people-outline" title="Debt not found" description="It may have been removed on another device." />
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
      setError('Enter an amount greater than 0.');
      Haptics.selectionAsync();
      return;
    }
    if (amountMinor > debt.remainingMinor) {
      setError(`Only ${formatMoney(debt.remainingMinor, debt.currency)} is left on this debt.`);
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
        description: isOwed ? `Repayment from ${who}` : `Repayment to ${who}`,
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
    Alert.alert(`Remove "${debt.name}"?`, 'It stops counting in your debt totals and alerts. Payments already logged as transactions stay.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
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
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg pb-3xl" keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isOwed ? 'Record repayment received' : 'Record a payment' }} />

      <Card className="gap-xs">
        <Overline>{isOwed ? `${who} still owes you` : `You still owe ${who}`}</Overline>
        <AmountText valueMinor={debt.remainingMinor} currency={debt.currency} size="lg" />
        <Caption>
          {debt.name} · {formatMoney(debt.principalMinor, debt.currency)} originally
        </Caption>
      </Card>

      {debt.remainingMinor > 0 ? (
        <>
          <View className="gap-sm">
            <Label>Amount ({debt.currency})</Label>
            <TextInput
              value={amountInput}
              onChangeText={setAmountInput}
              keyboardType="decimal-pad"
              placeholder={formatMoney(suggestedMinor, debt.currency, { showSymbol: false })}
              placeholderTextColor={colors['text-muted']}
              accessibilityLabel={`Payment amount in ${debt.currency}`}
              className="rounded-md border border-border-strong bg-surface px-md py-md text-[22px] text-text-primary"
            />
            <Caption>Leave empty to record {formatMoney(suggestedMinor, debt.currency)}.</Caption>
          </View>

          <Pressable
            onPress={() => setLogTransaction((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: logTransaction }}
            className="min-h-[44px] flex-row items-center gap-sm"
          >
            <Ionicons name={logTransaction ? 'checkbox' : 'square-outline'} size={20} color={logTransaction ? colors.accent : colors['text-muted']} />
            <BodySmall>Also record it as {isOwed ? 'money in' : 'money out'} on an account</BodySmall>
          </Pressable>
          {logTransaction && accounts.length > 1 ? (
            <ChipGroup options={accounts.map((a) => ({ id: a.id, label: a.name }))} selectedId={selectedAccountId} onSelect={setAccountId} />
          ) : null}

          {error ? <Caption className="text-danger">{error}</Caption> : null}
          <Button label={isSaving ? 'Saving…' : 'Save payment'} onPress={handleSave} disabled={isSaving} />
        </>
      ) : (
        <Body className="text-success">This debt is settled.</Body>
      )}

      <Pressable onPress={handleDelete} accessibilityRole="button" className="items-center py-md">
        <Body className="text-danger">Remove this debt</Body>
      </Pressable>
    </ScrollView>
  );
}
