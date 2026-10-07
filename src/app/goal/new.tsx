import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Body, BodySmall, Button, Caption, Label } from '@/components/ui';
import { DateField } from '@/components/ui/DateField';
import { goalsRepository } from '@/database/repositories';
import { useFinanceStore } from '@/store/financeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { formatMoney, parseMoneyInput } from '@/utils/currency';
import { useThemeColors } from '@/constants/theme';
import { FormScrollView } from '@/components/keyboard/keyboard';
import { useT } from '@/i18n';

const DEFAULT_DEADLINE_MONTHS = 6;

/**
 * Create a goal, or edit one when opened with `?id=` (from the goal
 * screen): name, target and an optional deadline. In edit mode the saved
 * amount isn't editable (it comes from "Add money"), and the goal can be
 * deleted.
 */
export default function NewGoalScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const colors = useThemeColors();
  const { t } = useT();
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency);
  const loadAll = useFinanceStore((s) => s.loadAll);
  const existing = useFinanceStore((s) => (id ? s.goals.find((g) => g.id === id) : undefined));
  const currency = existing?.currency ?? defaultCurrency;

  const [name, setName] = useState(existing?.name ?? '');
  const [targetInput, setTargetInput] = useState(existing ? formatMoney(existing.targetAmountMinor, currency, { showSymbol: false }) : '');
  const [currentInput, setCurrentInput] = useState('');
  const [hasDeadline, setHasDeadline] = useState(Boolean(existing?.deadline));
  const [deadline, setDeadline] = useState(() => {
    if (existing?.deadline) return new Date(existing.deadline);
    const d = new Date();
    d.setMonth(d.getMonth() + DEFAULT_DEADLINE_MONTHS);
    return d;
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const targetAmountMinor = parseMoneyInput(targetInput, currency);
    const currentAmountMinor = currentInput ? parseMoneyInput(currentInput, currency) : 0;
    if (!name.trim()) {
      setError(t('goalForm.nameError'));
      Haptics.selectionAsync();
      return;
    }
    if (targetAmountMinor === null || targetAmountMinor <= 0) {
      setError(t('goalForm.targetError'));
      Haptics.selectionAsync();
      return;
    }
    if (currentAmountMinor === null || currentAmountMinor < 0) {
      setError(t('goalForm.savedError'));
      Haptics.selectionAsync();
      return;
    }

    setIsSaving(true);
    const deadlineISO = hasDeadline ? deadline.toISOString() : null;
    if (existing) {
      await goalsRepository.updateGoal(existing.id, { name: name.trim(), targetAmountMinor, deadline: deadlineISO });
    } else {
      await goalsRepository.createGoal({ name: name.trim(), targetAmountMinor, currentAmountMinor, currency, deadline: deadlineISO, icon: 'flag' });
    }
    await loadAll();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const handleDelete = () => {
    if (!existing) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(t('goalForm.deleteTitle', { goal: existing.name }), t('goalForm.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await goalsRepository.deleteGoal(existing.id);
          await loadAll();
          // Close the form and the goal screen behind it, which no longer exists.
          router.dismissTo('/goals');
        },
      },
    ]);
  };

  return (
    <FormScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg pb-3xl">
      <Stack.Screen options={{ title: existing ? t('goalForm.editTitle') : t('nav.newGoal') }} />

      <View className="gap-sm">
        <Label>{t('goalForm.name')}</Label>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('goalForm.namePlaceholder')}
          placeholderTextColor={colors['text-muted']}
          className="rounded-md border border-border-strong bg-surface px-md py-md text-text-primary"
        />
      </View>

      <View className="gap-sm">
        <Label>{t('goalForm.target', { currency })}</Label>
        <TextInput
          value={targetInput}
          onChangeText={setTargetInput}
          keyboardType="decimal-pad"
          placeholder="900000"
          placeholderTextColor={colors['text-muted']}
          className="rounded-md border border-border-strong bg-surface px-md py-md text-[22px] text-text-primary"
        />
      </View>

      {existing ? (
        <Caption>{t('goalForm.savedSoFar', { amount: formatMoney(existing.currentAmountMinor, currency) })}</Caption>
      ) : (
        <View className="gap-sm">
          <Label>{t('goalForm.alreadySaved')}</Label>
          <TextInput
            value={currentInput}
            onChangeText={setCurrentInput}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors['text-muted']}
            className="rounded-md border border-border-strong bg-surface px-md py-md text-text-primary"
          />
        </View>
      )}

      <Pressable
        onPress={() => setHasDeadline((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: hasDeadline }}
        className="min-h-[44px] flex-row items-center gap-sm"
      >
        <Ionicons name={hasDeadline ? 'checkbox' : 'square-outline'} size={20} color={hasDeadline ? colors.accent : colors['text-muted']} />
        <BodySmall>{t('goalForm.setDeadline')}</BodySmall>
      </Pressable>
      {hasDeadline ? <DateField label={t('goalForm.reachBy')} value={deadline} onChange={setDeadline} minimumDate={new Date()} /> : null}

      {error ? <Caption className="text-danger">{error}</Caption> : null}

      <Button label={isSaving ? t('common.saving') : existing ? t('goalForm.save') : t('goalForm.create')} className="mt-sm" onPress={handleSave} disabled={isSaving} />

      {existing ? (
        <Pressable onPress={handleDelete} accessibilityRole="button" className="items-center py-md">
          <Body className="text-danger">{t('goalForm.delete')}</Body>
        </Pressable>
      ) : null}
    </FormScrollView>
  );
}
