import { useEffect, useState } from 'react';
import { Pressable, Switch, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from 'nativewind';
import { settingsRepository } from '@/database/repositories';
import { parseMoneyInput } from '@/utils/currency';
import { AmountText, Body, Button, Caption, Card, IconCircle, Label, SyncStatusBadge } from '@/components/ui';
import { useFinanceStore } from '@/store/financeStore';
import { aiStatus, providerLabel } from '@/ai';
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
import { FormScrollView } from '@/components/keyboard/keyboard';
import { useLanguageStore, useT, type LanguageSetting, type MessageKey } from '@/i18n';
import { setLanguage } from '@/i18n/languageSettings';

const THEME_OPTIONS: { mode: ThemeMode; label: MessageKey; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: 'light', label: 'settings.theme.light', icon: 'sunny-outline' },
  { mode: 'dark', label: 'settings.theme.dark', icon: 'moon-outline' },
  { mode: 'system', label: 'settings.theme.system', icon: 'phone-portrait-outline' },
];

const LANGUAGE_OPTIONS: LanguageSetting[] = ['system', 'en', 'fr'];

/** Phone reminders: the morning before bills and debt payments, and when a budget reaches 85%. */
function RemindersSection() {
  const colors = useThemeColors();
  const { t } = useT();
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
          <Body>{t('settings.reminders')}</Body>
          <Caption>{t('settings.remindersHint')}</Caption>
        </View>
        <Switch
          value={enabled}
          onValueChange={toggle}
          disabled={isBusy || remindersUnsupportedHere}
          accessibilityLabel={t('settings.reminders')}
          trackColor={{ false: colors['surface-elevated'], true: colors.accent }}
          thumbColor={colors.surface}
        />
      </View>
      {remindersUnsupportedHere ? (
        <Caption className="text-warning">{t('settings.remindersExpoGo')}</Caption>
      ) : message ? (
        <Caption className="text-warning">{message}</Caption>
      ) : null}
    </Card>
  );
}

/** App lock: fingerprint, face or passcode on open and after a minute away. */
function SecuritySection() {
  const colors = useThemeColors();
  const { t } = useT();
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
      <Label>{t('settings.security')}</Label>
      <View className="flex-row items-center justify-between gap-md">
        <View className="flex-1">
          <Body>{t('settings.appLock')}</Body>
          <Caption>{t('settings.appLockHint')}</Caption>
        </View>
        <Switch
          value={enabled}
          onValueChange={toggle}
          disabled={isBusy}
          accessibilityLabel={t('settings.appLock')}
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
  const { t } = useT();

  return (
    <Card className="gap-md">
      <Label>{t('settings.appearance')}</Label>
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
            <Caption className={mode === option.mode ? 'text-accent-secondary' : undefined}>{t(option.label)}</Caption>
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
  const { t } = useT();

  if (status === 'loading') {
    return (
      <Card className="gap-sm">
        <Label>{t('settings.account')}</Label>
        <Caption>{t('settings.checkingSignIn')}</Caption>
      </Card>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <Card className="gap-md">
        <Label>{t('settings.account')}</Label>
        <Caption>{t('settings.notSignedIn')}</Caption>
        <Button label={t('settings.signInOrCreate')} onPress={() => router.push('/auth/welcome')} />
      </Card>
    );
  }

  return (
    <Card className="gap-md">
      <Label>{t('settings.account')}</Label>
      <View>
        <Body>{t('settings.signedInAs')}</Body>
        <Caption>{user?.email ?? user?.displayName ?? user?.uid}</Caption>
      </View>

      {workspaceMismatch ? (
        <Caption className="text-danger">
          {t('settings.workspaceMismatch')}
        </Caption>
      ) : (
        <View className="flex-row items-center justify-between">
          <SyncStatusBadge status={syncStatus} />
          <Pressable onPress={runSync} disabled={syncStatus === 'syncing'}>
            <Caption className="text-accent-secondary">{t('settings.syncNow')}</Caption>
          </Pressable>
        </View>
      )}

      <Button label={t('settings.signOut')} variant="secondary" onPress={signOut} />
    </Card>
  );
}

/**
 * The emergency reserve kept out of "Available to spend safely". Without a
 * value set here, F-AI suggests 3 months of last month's spending
 * (getReserveTargetMinor in src/finance/aggregates.ts).
 */
function ReserveSection() {
  const colors = useThemeColors();
  const { reserveTargetMinor, loadAll } = useFinanceStore();
  const currency = useSettingsStore((s) => s.defaultCurrency);
  const { t } = useT();
  // Same key getReserveTargetMinor reads (src/finance/aggregates.ts).
  const RESERVE_KEY = `reserve_target_minor_${currency}`;
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
  }, [reserveTargetMinor, RESERVE_KEY]);

  const save = async () => {
    const minor = parseMoneyInput(input, currency);
    if (minor === null || minor < 0) {
      setError(t('settings.reserveError'));
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
      <Label>{t('settings.reserve')}</Label>
      <View className="flex-row items-baseline justify-between">
        <AmountText valueMinor={reserveTargetMinor} currency={currency} size="md" />
        <Caption>{isCustom ? t('settings.reserveSetByYou') : t('settings.reserveSuggested')}</Caption>
      </View>
      <Caption>{t('settings.reserveHint')}</Caption>
      <View className="flex-row items-center gap-sm">
        <TextInput
          value={input}
          onChangeText={setInput}
          keyboardType="decimal-pad"
          placeholder={t('settings.reservePlaceholder', { currency })}
          placeholderTextColor={colors['text-muted']}
          accessibilityLabel={t('settings.reserveA11y', { currency })}
          className="flex-1 rounded-md border border-border-strong bg-surface px-md py-sm text-text-primary"
        />
        <Button label={t('settings.set')} variant="secondary" onPress={save} disabled={!input.trim()} />
      </View>
      {error ? <Caption className="text-danger">{error}</Caption> : null}
      {isCustom ? (
        <Pressable onPress={useSuggested} accessibilityRole="button" className="min-h-[44px] justify-center">
          <Caption className="font-sans-semibold text-accent-secondary">{t('settings.useSuggested')}</Caption>
        </Pressable>
      ) : null}
    </Card>
  );
}

/** App language; the copilot answers in it too. */
function LanguageSection() {
  const { t } = useT();
  const setting = useLanguageStore((s) => s.setting);

  return (
    <Card className="gap-md">
      <Label>{t('settings.language')}</Label>
      <View className="flex-row gap-sm">
        {LANGUAGE_OPTIONS.map((option) => (
          <Pressable
            key={option}
            onPress={() => {
              setLanguage(option);
              Haptics.selectionAsync();
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: setting === option }}
            className={cn('flex-1 items-center rounded-sm border py-md', setting === option ? 'border-accent bg-accent-muted' : 'border-border bg-background')}
          >
            <Caption className={setting === option ? 'text-accent-secondary' : undefined}>{t(`settings.language.${option}`)}</Caption>
          </Pressable>
        ))}
      </View>
      <Caption>{t('settings.languageHint')}</Caption>
    </Card>
  );
}

/** The money accounts (cash, mobile money, bank) that balances are computed from. */
function MoneyAccountsSection() {
  const { accounts, transactions } = useFinanceStore();
  const { t } = useT();

  return (
    <Card className="gap-sm">
      <Label>{t('settings.yourAccounts')}</Label>
      {accounts.map((account, index) => {
        const meta = getAccountTypeMeta(account.type);
        return (
          <Pressable
            key={account.id}
            onPress={() => router.push({ pathname: '/account/edit', params: { id: account.id } })}
            accessibilityRole="button"
            accessibilityHint={t('settings.editAccount')}
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
      <Button label={t('settings.addAccount')} variant="secondary" onPress={() => router.push('/account/edit')} />
    </Card>
  );
}

export default function SettingsScreen() {
  const colors = useThemeColors();
  const { defaultCurrency, setDefaultCurrency } = useSettingsStore();
  const { t } = useT();

  return (
    <FormScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg">
      <AccountSection />

      <MoneyAccountsSection />

      <ReserveSection />

      <Pressable onPress={() => router.push('/bills')} accessibilityRole="button">
        <Card className="flex-row items-center justify-between">
          <View>
            <Label>{t('nav.bills')}</Label>
            <Caption>{t('settings.billsHint')}</Caption>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors['text-muted']} />
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push('/income')} accessibilityRole="button">
        <Card className="flex-row items-center justify-between">
          <View>
            <Label>{t('nav.income')}</Label>
            <Caption>{t('settings.incomeHint')}</Caption>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors['text-muted']} />
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push('/debts')} accessibilityRole="button">
        <Card className="flex-row items-center justify-between">
          <View>
            <Label>{t('nav.debts')}</Label>
            <Caption>{t('settings.debtsHint')}</Caption>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors['text-muted']} />
        </Card>
      </Pressable>

      <SecuritySection />

      <RemindersSection />

      <AppearanceSection />

      <LanguageSection />

      <Card className="gap-md">
        <Label>{t('settings.currency')}</Label>
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
              <Body>{t(`currency.${meta.code}` as MessageKey)}</Body>
              <Caption>
                {meta.code} · {meta.symbol}
              </Caption>
            </View>
            {defaultCurrency === meta.code ? <Caption className="text-accent-secondary">{t('settings.active')}</Caption> : null}
          </Pressable>
        ))}
      </Card>

      <Card className="gap-sm">
        <Label>{t('settings.about')}</Label>
        <Caption>
          {t('settings.aboutText')}
        </Caption>
        <Caption>
          {aiStatus.provider === 'mock'
            ? t('settings.aiOffline')
            : t(aiStatus.transport === 'proxy' ? 'settings.aiProxy' : 'settings.aiProvider', { provider: providerLabel(), model: aiStatus.model ?? '' })}
          {aiStatus.problem ? `. ${aiStatus.problem}` : ''}
        </Caption>
        {aiStatus.provider !== 'mock' && aiStatus.transport === 'direct' ? (
          <Caption className="text-warning">{t('settings.devKey')}</Caption>
        ) : null}
      </Card>
    </FormScrollView>
  );
}
