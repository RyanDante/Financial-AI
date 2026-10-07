import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Body, Button, Caption, Label } from '@/components/ui';
import { useFinanceStore } from '@/store/financeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useThemeColors } from '@/constants/theme';
import { ACCOUNT_TYPES, canArchiveAccount } from '@/features/accounts/accountTypes';
import { formatMoney, parseMoneyInput } from '@/utils/currency';
import { cn } from '@/utils/cn';
import type { AccountType } from '@/types/finance';
import { FormScrollView } from '@/components/keyboard/keyboard';

/**
 * Add an account, or edit one when opened with `?id=` (from Settings).
 * The starting balance is what the account held before the first
 * transaction recorded in F-AI; the live balance adds transactions to it.
 */
export default function EditAccountScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const colors = useThemeColors();
  const accounts = useFinanceStore((s) => s.accounts);
  const { createAccount, updateAccount } = useFinanceStore();
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency);
  const existing = id ? accounts.find((a) => a.id === id) : undefined;
  const currency = existing?.currency ?? defaultCurrency;

  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<AccountType>(existing?.type ?? 'mobile_money');
  const [balanceInput, setBalanceInput] = useState(existing ? formatMoney(existing.initialBalanceMinor, currency, { showSymbol: false }) : '');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Give the account a name, e.g. "MTN MoMo".');
      Haptics.selectionAsync();
      return;
    }
    const initialBalanceMinor = balanceInput.trim() === '' ? 0 : parseMoneyInput(balanceInput, currency);
    if (initialBalanceMinor === null) {
      setError('Enter the starting balance as a number, or leave it empty for 0.');
      Haptics.selectionAsync();
      return;
    }

    setIsSaving(true);
    if (existing) {
      await updateAccount(existing.id, { name: name.trim(), type, initialBalanceMinor });
    } else {
      await createAccount({ name: name.trim(), type, currency, initialBalanceMinor, icon: null, color: null });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const handleArchive = () => {
    if (!existing) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(`Archive ${existing.name}?`, 'It disappears from your accounts and total balance. Its past transactions stay in your history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          await updateAccount(existing.id, { isArchived: true });
          router.back();
        },
      },
    ]);
  };

  return (
    <FormScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg">
      <Stack.Screen options={{ title: existing ? 'Edit account' : 'Add account' }} />

      <View className="gap-sm">
        <Label>Name</Label>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. MTN MoMo, Afriland, Wallet"
          placeholderTextColor={colors['text-muted']}
          className="rounded-md border border-border-strong bg-surface px-md py-md text-text-primary"
        />
      </View>

      <View className="gap-sm">
        <Label>Type</Label>
        <View className="flex-row flex-wrap gap-sm">
          {ACCOUNT_TYPES.map((option) => {
            const isSelected = option.type === type;
            return (
              <Pressable
                key={option.type}
                onPress={() => setType(option.type)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                className={cn('flex-row items-center gap-xs rounded-sm border px-md py-sm', isSelected ? 'border-accent bg-accent-muted' : 'border-border bg-surface')}
              >
                <Ionicons name={option.icon} size={14} color={isSelected ? colors['accent-secondary'] : colors['text-secondary']} />
                <Label className={isSelected ? 'text-accent-secondary' : undefined}>{option.label}</Label>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-sm">
        <Label>Starting balance ({currency})</Label>
        <TextInput
          value={balanceInput}
          onChangeText={setBalanceInput}
          keyboardType="numbers-and-punctuation"
          placeholder="0"
          placeholderTextColor={colors['text-muted']}
          className="rounded-md border border-border-strong bg-surface px-md py-md text-[22px] text-text-primary"
        />
        <Caption>What the account held before your first transaction in F-AI. Use a minus sign for money owed.</Caption>
      </View>

      {error ? <Caption className="text-danger">{error}</Caption> : null}

      <Button label={isSaving ? 'Saving…' : 'Save account'} className="mt-sm" onPress={handleSave} disabled={isSaving} />

      {existing && canArchiveAccount(existing, accounts) ? (
        <Pressable onPress={handleArchive} accessibilityRole="button" className="items-center py-md">
          <Body className="text-danger">Archive account</Body>
        </Pressable>
      ) : null}
      {existing && !canArchiveAccount(existing, accounts) ? (
        <Caption className="text-center">This is your only account, so it can&rsquo;t be archived.</Caption>
      ) : null}
    </FormScrollView>
  );
}
