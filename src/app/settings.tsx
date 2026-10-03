import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { Body, Button, Caption, Card, Label, SyncStatusBadge } from '@/components/ui';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/features/auth/auth.store';
import { useSyncStore } from '@/store/syncStore';
import { useThemeStore } from '@/features/theme/theme.store';
import type { ThemeMode } from '@/features/theme/theme.types';
import { CURRENCIES, type CurrencyCode } from '@/constants/currencies';
import { getColors } from '@/constants/theme';
import { cn } from '@/utils/cn';

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: 'light', label: 'Light', icon: 'sunny-outline' },
  { mode: 'dark', label: 'Dark', icon: 'moon-outline' },
  { mode: 'system', label: 'Match device', icon: 'phone-portrait-outline' },
];

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

export default function SettingsScreen() {
  const { defaultCurrency, setDefaultCurrency } = useSettingsStore();

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg">
      <AccountSection />

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
          Security (app lock, biometrics) is planned for a future update.
        </Caption>
      </Card>
    </ScrollView>
  );
}
