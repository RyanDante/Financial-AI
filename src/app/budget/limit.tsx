import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Body, Button, Caption, Heading, Label } from '@/components/ui';
import { budgetsRepository } from '@/database/repositories';
import { useFinanceStore } from '@/store/financeStore';
import { useThemeColors } from '@/constants/theme';
import { DEFAULT_CURRENCY, isCurrencyCode, type CurrencyCode } from '@/constants/currencies';
import { formatMoney, parseMoneyInput } from '@/utils/currency';

/** Modal for changing one category's limit in this month's budget. */
export default function BudgetLimitScreen() {
  const params = useLocalSearchParams<{ budgetCategoryId: string; categoryId: string; limitMinor: string; currency: string }>();
  const colors = useThemeColors();
  const category = useFinanceStore((s) => s.categories.find((c) => c.id === params.categoryId));
  const loadAll = useFinanceStore((s) => s.loadAll);
  const currency: CurrencyCode = params.currency && isCurrencyCode(params.currency) ? params.currency : DEFAULT_CURRENCY;
  const currentLimitMinor = Number(params.limitMinor) || 0;
  const [limitInput, setLimitInput] = useState(formatMoney(currentLimitMinor, currency, { showSymbol: false }));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const limitMinor = parseMoneyInput(limitInput, currency);
    if (limitMinor === null || limitMinor <= 0) {
      setError('Enter a limit greater than 0.');
      Haptics.selectionAsync();
      return;
    }
    if (!params.budgetCategoryId) return;
    setIsSaving(true);
    await budgetsRepository.updateBudgetCategoryLimit(params.budgetCategoryId, limitMinor);
    // Refreshing the store also makes useAlerts re-read the limits, so the bell updates.
    await loadAll();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg" keyboardShouldPersistTaps="handled">
      <View className="gap-xs">
        <Heading>{category?.name ?? 'Category'} limit</Heading>
        <Body className="text-text-secondary">Current limit: {formatMoney(currentLimitMinor, currency)} this month.</Body>
      </View>

      <View className="gap-sm">
        <Label>Monthly limit ({currency})</Label>
        <TextInput
          value={limitInput}
          onChangeText={setLimitInput}
          keyboardType="decimal-pad"
          autoFocus
          selectTextOnFocus
          placeholderTextColor={colors['text-muted']}
          className="rounded-md border border-border-strong bg-surface px-md py-md text-[22px] text-text-primary"
        />
        {error ? <Caption className="text-danger">{error}</Caption> : null}
      </View>

      <View className="flex-row gap-sm pt-sm">
        <Button label="Cancel" variant="secondary" className="flex-1" onPress={() => router.back()} />
        <Button label={isSaving ? 'Saving…' : 'Save'} className="flex-1" onPress={handleSave} disabled={isSaving} />
      </View>
    </ScrollView>
  );
}
