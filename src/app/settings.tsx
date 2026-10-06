import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from 'nativewind';
import { settingsRepository } from '@/database/repositories';
import { DEFAULT_CURRENCY } from '@/constants/currencies';
import { parseMoneyInput } from '@/utils/currency';
import { AmountText, Body, Button, Caption, Card, IconCircle, Label, SyncStatusBadge } from '@/components/ui';
import { useFinanceStore } from '@/store/financeStore';
import { aiStatus } from '@/ai';
import { useAppLockStore } from '@/features/security/appLock.store';
import { disableReminders, enableReminders, remindersEnabled, remindersUnsupportedHere } from '@/features/reminders/reminders.service';
import { calculateBalance } from '@/finance/calculations';
import { getAccountTypeMeta } from '@/features/accounts/accountTypes';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/features/auth/auth.store';
import { useSyncStore } from '@/store/syncStore';
import { useThemeStore } from '@/features/theme/theme.store';
import type { ThemeMode } from '@/features/theme/theme.types';
import { CURRENCIES, type CurrencyCode } from '@/constants/currencies';
import { getColors, useThemeColors } from '@/constants/theme';
import { cn } from '@/utils/cn';

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: 'light', label: 'Light', icon: 'sunny-outline' },
  { mode: 'dark', label: 'Dark', icon: 'moon-outline' },
  { mode: 'system', label: 'Match device', icon: 'phone-portrait-outline' },
];

/** Phone reminders: the morning before bills and debt payments, and when a budget reaches 85%. */
function RemindersSection() {
  const colors = useThemeColors();
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    remindersEnabled().then((value) => {
      if (isCurrent) setEnabled(value);
    });
    return () => {
      isCurrent = false;
    };
  }, []);

  const toggle = async (next: boolean) => {
    setIsBusy(true);
    if (next) {
      const problem = await enableReminders();
      setMessage(problem);
      setEnabled(problem === null);
    } else {
      await disableReminders();
      setMessage(null);
      setEnabled(false);
    }
    setIsBusy(false);
  };

  return (
    <Card className="gap-sm">
      <View className="flex-row items-center justify-between gap-md">
        <View className="flex-1">
          <Body>Reminders</Body>
          <Caption>A notification the morning before a bill or debt payment is due, and when a budget category reaches 85%.</Caption>
        </View>
        <Switch
          value={enabled}
          onValueChange={toggle}
          disabled={isBusy || remindersUnsupportedHere}
          accessibilityLabel="Reminders"
          trackColor={{ false: colors['surface-elevated'], true: colors.accent }}
          thumbColor={colors.surface}
        />
      </View>
      {remindersUnsupportedHere ? (
        <Caption className="text-warning">Reminders need a development build on Android; Expo Go doesn&rsquo;t support them.</Caption>
      ) : message ? (
        <Caption className="text-warning">{message}</Caption>
      ) : null}
    </Card>
  );
}

/** App lock: fingerprint, face or passcode on open and after a minute away. */
function SecuritySection() {
  const colors = useThemeColors();
  const { enabled, setEnabled } = useAppLockStore();
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const toggle = async (next: boolean) => {
    setIsBusy(true);
    setMessage(await setEnabled(next));
    setIsBusy(false);
  };

  return (
    <Card className="gap-sm">
      <Label>Security</Label>
      <View className="flex-row items-center justify-between gap-md">
        <View className="flex-1">
          <Body>App lock</Body>
          <Caption>Ask for your fingerprint, face or phone passcode when F-AI opens, and after a minute away.</Caption>
        </View>
        <Switch
          value={enabled}
          onValueChange={toggle}
          disabled={isBusy}
          accessibilityLabel="App lock"
          trackColor={{ false: colors['surface-elevated'], true: colors.accent }}
          thumbColor={colors.surface}
        />
      </View>
      {message ? <Caption className="text-warning">{message}</Caption> : null}
    </Card>
  );
}

function AppearanceSection() {
  const { mode, setMode } = useThemeStore();
  const { colorScheme } = useColorScheme();
  const colors = getColors(colorScheme ?? 'dark');

  return (
    <Card className="gap-md">
      <Label>Appearance</Label>
      <View className="flex-row gap-sm">
        {THEME_OPTIONS.map((option) => (
          <Pressable
            key={option.mode}
            onPress={() => setMode(option.mode)}
            className={cn(
              'flex-1 items-center gap-xs rounded-sm border py-md',
              mode === option.mode ? 'border-accent bg-accent-muted' : 'border-border bg-background',
            )}
          >
            <Ionicons name={option.icon} size={18} color={mode === option.mode ? colors.accent : colors['text-secondary']} />
            <Caption className={mode === option.mode ? 'text-accent-secondary' : undefined}>{option.label}</Caption>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

function AccountSection() {
  const { status, user, workspaceMismatch, signOut } = useAuthStore();
  const syncStatus = useSyncStore((s) => s.status);
  const runSync = useSyncStore((s) => s.runSync);

  if (status === 'loading') {
    return (
      <Card className="gap-sm">
        <Label>Account</Label>
        <Caption>Checking sign-in status…</Caption>
      </Card>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <Card className="gap-md">
        <Label>Account</Label>
        <Caption>You&apos;re not signed in — F-AI works fully offline either way. Sign in to back up and sync your data.</Caption>
        <Button label="Sign in or create account" onPress={() => router.push('/auth/welcome')} />
      </Card>
    );
  }

  return (
    <Card className="gap-md">
      <Label>Account</Label>
      <View>
        <Body>Signed in as</Body>
        <Caption>{user?.email ?? user?.displayName ?? user?.uid}</Caption>
      </View>

      {workspaceMismatch ? (
        <Caption className="text-danger">
          This device&apos;s local data belongs to a different account, so syncing is paused. Sign in with that account to
          sync it, or sign out to keep using F-AI locally.
        </Caption>
      ) : (
        <View className="flex-row items-center justify-between">
          <SyncStatusBadge status={syncStatus} />
          <Pressable onPress={runSync} disabled={syncStatus === 'syncing'}>
            <Caption className="text-accent-secondary">Sync now</Caption>
          </Pressable>
        </View>
      )}

      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </Card>
  );
}

const RESERVE_KEY = `reserve_target_minor_${DEFAULT_CURRENCY}`;

/**
 * The emergency reserve kept out of "Available to spend safely". Without a
 * value set here, F-AI suggests 3 months of last month's spending
 * (getReserveTargetMinor in src/finance/aggregates.ts).
 */
function ReserveSection() {
  const colors = useThemeColors();
  const { reserveTargetMinor, loadAll } = useFinanceStore();
  const [isCustom, setIsCustom] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    settingsRepository.getSetting(RESERVE_KEY).then((value) => {
      if (isCurrent) setIsCustom(value !== null);
    });
    return () => {
      isCurrent = false;
    };
  }, [reserveTargetMinor]);

  const save = async () => {
    const minor = parseMoneyInput(input, DEFAULT_CURRENCY);
    if (minor === null || minor < 0) {
      setError('Enter 0 or more.');
      return;
    }
    setError(null);
    await settingsRepository.setSetting(RESERVE_KEY, String(minor));
    setInput('');
    await loadAll();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const useSuggested = async () => {
    await settingsRepository.deleteSetting(RESERVE_KEY);
    await loadAll();
    Haptics.selectionAsync();
  };

  return (
    <Card className="gap-sm">
      <Label>Savings reserve</Label>
      <View className="flex-row items-baseline justify-between">
        <AmountText valueMinor={reserveTargetMinor} currency={DEFAULT_CURRENCY} size="md" />
        <Caption>{isCustom ? 'Set by you' : 'Suggested: 3 months of spending'}</Caption>
      </View>
      <Caption>Kept aside from &ldquo;Available to spend safely&rdquo; for emergencies.</Caption>
      <View className="flex-row items-center gap-sm">
        <TextInput
          value={input}
          onChangeText={setInput}
          keyboardType="decimal-pad"
          placeholder={`New amount (${DEFAULT_CURRENCY})`}
          placeholderTextColor={colors['text-muted']}
          accessibilityLabel={`New reserve amount in ${DEFAULT_CURRENCY}`}
          className="flex-1 rounded-md border border-border-strong bg-surface px-md py-sm text-text-primary"
        />
        <Button label="Set" variant="secondary" onPress={save} disabled={!input.trim()} />
      </View>
      {error ? <Caption className="text-danger">{error}</Caption> : null}
      {isCustom ? (
        <Pressable onPress={useSuggested} accessibilityRole="button" className="min-h-[44px] justify-center">
          <Caption className="font-sans-semibold text-accent-secondary">Use the suggested amount instead</Caption>
        </Pressable>
      ) : null}
    </Card>
  );
}

/** The money accounts (cash, mobile money, bank) that balances are computed from. */
function MoneyAccountsSection() {
  const { accounts, transactions } = useFinanceStore();

  return (
    <Card className="gap-sm">
      <Label>Your accounts</Label>
      {accounts.map((account, index) => {
        const meta = getAccountTypeMeta(account.type);
        return (
          <Pressable
            key={account.id}
            onPress={() => router.push({ pathname: '/account/edit', params: { id: account.id } })}
            accessibilityRole="button"
            accessibilityHint="Edit this account"
            className={cn('flex-row items-center gap-md py-sm', index > 0 && 'border-t border-border')}
          >
            <IconCircle name={meta.icon} size={32} />
            <View className="flex-1">
              <Body numberOfLines={1}>{account.name}</Body>
              <Caption>{meta.label}</Caption>
            </View>
            <AmountText valueMinor={calculateBalance(account, transactions)} currency={account.currency} size="sm" />
          </Pressable>
        );
      })}
      <Button label="Add account" variant="secondary" onPress={() => router.push('/account/edit')} />
    </Card>
  );
}

export default function SettingsScreen() {
  const colors = useThemeColors();
  const { defaultCurrency, setDefaultCurrency } = useSettingsStore();

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg">
      <AccountSection />

      <MoneyAccountsSection />

      <ReserveSection />

      <Pressable onPress={() => router.push('/bills')} accessibilityRole="button">
        <Card className="flex-row items-center justify-between">
          <View>
            <Label>Bills & subscriptions</Label>
            <Caption>Rent, utilities and plans F-AI sets money aside for</Caption>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors['text-muted']} />
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push('/income')} accessibilityRole="button">
        <Card className="flex-row items-center justify-between">
          <View>
            <Label>Income & payday</Label>
            <Caption>Salary and other income; sets your daily allowance</Caption>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors['text-muted']} />
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push('/debts')} accessibilityRole="button">
        <Card className="flex-row items-center justify-between">
          <View>
            <Label>Debts</Label>
            <Caption>Loans you repay and money people owe you</Caption>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors['text-muted']} />
        </Card>
      </Pressable>

      <SecuritySection />

      <RemindersSection />

      <AppearanceSection />

      <Card className="gap-md">
        <Label>Default currency</Label>
        {Object.values(CURRENCIES).map((meta) => (
          <Pressable
            key={meta.code}
            onPress={() => setDefaultCurrency(meta.code as CurrencyCode)}
            className={cn(
              'flex-row items-center justify-between rounded-sm border px-md py-md',
              defaultCurrency === meta.code ? 'border-accent bg-accent-muted' : 'border-border bg-background',
            )}
          >
            <View>
              <Body>{meta.name}</Body>
              <Caption>
                {meta.code} · {meta.symbol}
              </Caption>
            </View>
            {defaultCurrency === meta.code ? <Caption className="text-accent-secondary">Active</Caption> : null}
          </Pressable>
        ))}
      </Card>

      <Card className="gap-sm">
        <Label>About</Label>
        <Caption>
          F-AI keeps your financial data on this device first. Cloud backup, when you sign in, stores it under your
          account in Firebase, scoped so only you can read or write it — see docs/FIREBASE.md for the full picture.
        </Caption>
        <Caption>
          AI copilot: {aiStatus.provider === 'mock' ? 'offline (built-in rules)' : `${aiStatus.provider} · ${aiStatus.model}`}
          {aiStatus.problem ? `. ${aiStatus.problem}` : ''}
        </Caption>
        {aiStatus.provider !== 'mock' ? (
          <Caption className="text-warning">Development key: the AI key in .env is built into this app. Don&rsquo;t share or publish this build.</Caption>
        ) : null}
      </Card>
    </ScrollView>
  );
}
