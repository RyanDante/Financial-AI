import '../styles/global.css';
import { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts as useInterFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts as useSpaceGroteskFonts, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { getDatabase } from '@/database/client';
import { useFinanceStore } from '@/store/financeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/features/auth/auth.store';
import { useSyncStore } from '@/store/syncStore';
import { useThemeStore } from '@/features/theme/theme.store';
import { modalOptions, usePageHeaderOptions } from '@/components/navigation/pageHeader';
import { useAppLockStore } from '@/features/security/appLock.store';
import { LockScreen } from '@/components/ui/LockScreen';
import { useOnboardingStore } from '@/features/onboarding/onboarding.store';
import { configureNotifications, onReminderTapped, syncReminders } from '@/features/reminders/reminders.service';
import { KeyboardRoot } from '@/components/keyboard/keyboard';
import { useT } from '@/i18n';
import { loadLanguage } from '@/i18n/languageSettings';

SplashScreen.preventAutoHideAsync().catch(() => {});
configureNotifications();

export default function RootLayout() {
  const [fontsLoaded] = useInterFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [displayFontsLoaded] = useSpaceGroteskFonts({ SpaceGrotesk_500Medium, SpaceGrotesk_700Bold });
  const [isDbReady, setIsDbReady] = useState(false);
  const loadAll = useFinanceStore((s) => s.loadAll);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const initializeAuth = useAuthStore((s) => s.initialize);
  const initializeSync = useSyncStore((s) => s.initialize);
  const loadTheme = useThemeStore((s) => s.loadTheme);
  const loadLock = useAppLockStore((s) => s.loadLock);
  const loadOnboarding = useOnboardingStore((s) => s.loadOnboarding);
  const isLocked = useAppLockStore((s) => s.locked);
  const { colorScheme } = useColorScheme();
  const pageHeaderOptions = usePageHeaderOptions();
  const { t } = useT();

  useEffect(() => {
    (async () => {
      await getDatabase();
      await Promise.all([loadAll(), loadSettings(), loadTheme(), loadLock(), loadOnboarding(), loadLanguage()]);
      setIsDbReady(true);
    })();
    // Firebase Auth/Firestore calls here are independent of local readiness —
    // auth state restoration and sync should start as soon as possible, and
    // both already fail gracefully offline (see auth.store.ts / sync.service.ts).
    initializeAuth();
    initializeSync();
  }, [loadAll, loadSettings, loadTheme, loadLock, loadOnboarding, initializeAuth, initializeSync]);

  // Rebuild reminders whenever data changes (every write path reloads the finance store).
  const transactions = useFinanceStore((s) => s.transactions);
  useEffect(() => {
    if (isDbReady) syncReminders();
  }, [isDbReady, transactions]);

  // Tapping a reminder opens the page it's about.
  useEffect(() => {
    return onReminderTapped((url) => router.push(url));
  }, []);

  // Re-lock after a minute in the background (app lock, Settings › Security).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const lock = useAppLockStore.getState();
      if (state === 'background') lock.onBackground();
      else if (state === 'active') lock.onForeground();
    });
    return () => subscription.remove();
  }, []);

  const isReady = fontsLoaded && displayFontsLoaded && isDbReady;

  const onLayoutRootView = useCallback(async () => {
    if (isReady) {
      await SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <KeyboardRoot>
          <View className="flex-1 bg-background" onLayout={onLayoutRootView}>
            <StatusBar style={colorScheme === 'light' ? 'dark' : 'light'} />
            <Stack screenOptions={pageHeaderOptions}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
              <Stack.Screen name="auth" options={{ presentation: 'modal', headerShown: false }} />
              <Stack.Screen name="transaction/[id]" options={{ title: t('nav.transaction') }} />
              <Stack.Screen name="goal/[id]" options={{ title: t('nav.goal') }} />
              <Stack.Screen name="alerts" options={{ title: t('nav.alerts') }} />
              <Stack.Screen name="settings" options={{ title: t('nav.settings') }} />
              <Stack.Screen name="bills/index" options={{ title: t('nav.bills') }} />
              <Stack.Screen name="debts/index" options={{ title: t('nav.debts') }} />
              <Stack.Screen name="income/index" options={{ title: t('nav.income') }} />
              <Stack.Screen name="transaction/new" options={modalOptions(t('nav.addTransaction'))} />
              <Stack.Screen name="goal/new" options={modalOptions(t('nav.newGoal'))} />
              <Stack.Screen name="budget/limit" options={modalOptions(t('nav.budgetLimit'))} />
              <Stack.Screen name="account/edit" options={modalOptions(t('nav.account'))} />
              <Stack.Screen name="bills/new" options={modalOptions(t('nav.addBill'))} />
              <Stack.Screen name="import/sms" options={modalOptions(t('nav.importSms'))} />
              <Stack.Screen name="debts/new" options={modalOptions(t('nav.addDebt'))} />
              <Stack.Screen name="debts/pay" options={modalOptions(t('nav.recordPayment'))} />
              <Stack.Screen name="income/new" options={modalOptions(t('nav.addIncome'))} />
              <Stack.Screen name="ai/conversations" options={modalOptions(t('nav.yourChats'))} />
              <Stack.Screen name="share" options={{ title: t('nav.shared') }} />
            </Stack>
            {isLocked ? <LockScreen /> : null}
          </View>
        </KeyboardRoot>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
