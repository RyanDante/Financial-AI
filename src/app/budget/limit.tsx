import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Body, Button, Caption, Label } from '@/components/ui';
import { budgetsRepository } from '@/database/repositories';
import { useFinanceStore } from '@/store/financeStore';
import { useThemeColors } from '@/constants/theme';
import { DEFAULT_CURRENCY, isCurrencyCode, type CurrencyCode } from '@/constants/currencies';
import { formatMoney, parseMoneyInput } from '@/utils/currency';
import { FormScrollView } from '@/components/keyboard/keyboard';
import { categoryLabel, useT } from '@/i18n';

/** Modal for changing one category's limit in this month's budget. */
export default function BudgetLimitScreen() {
  const params = useLocalSearchParams<{ budgetCategoryId: string; categoryId: string; limitMinor: string; currency: string }>();
  const colors = useThemeColors();
  const { t } = useT();
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
      setError(t('limit.error'));
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
    <FormScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg">
      <Stack.Screen options={{ title: t('limit.title', { category: category ? categoryLabel(category.name) : t('limit.category') }) }} />
      <Body className="text-text-secondary">{t('limit.current', { amount: formatMoney(currentLimitMinor, currency) })}</Body>

      <View className="gap-sm">
        <Label>{t('limit.monthly', { currency })}</Label>
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

      <Button label={isSaving ? t('common.saving') : t('limit.save')} className="mt-sm" onPress={handleSave} disabled={isSaving} />
    </FormScrollView>
  );
}
