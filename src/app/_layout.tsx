import '../styles/global.css';
import { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
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
import { configureNotifications, syncReminders } from '@/features/reminders/reminders.service';

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

  useEffect(() => {
    (async () => {
      await getDatabase();
      await Promise.all([loadAll(), loadSettings(), loadTheme(), loadLock(), loadOnboarding()]);
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
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (url === '/bills' || url === '/debts' || url === '/budgets') router.push(url);
    });
    return () => subscription.remove();
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
        <View className="flex-1 bg-background" onLayout={onLayoutRootView}>
          <StatusBar style={colorScheme === 'light' ? 'dark' : 'light'} />
          <Stack screenOptions={pageHeaderOptions}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
            <Stack.Screen name="auth" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="transaction/[id]" options={{ title: 'Transaction' }} />
            <Stack.Screen name="goal/[id]" options={{ title: 'Goal' }} />
            <Stack.Screen name="alerts" options={{ title: 'Alerts' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            <Stack.Screen name="bills/index" options={{ title: 'Bills & subscriptions' }} />
            <Stack.Screen name="debts/index" options={{ title: 'Debts' }} />
            <Stack.Screen name="income/index" options={{ title: 'Income & payday' }} />
            <Stack.Screen name="transaction/new" options={modalOptions('Add transaction')} />
            <Stack.Screen name="goal/new" options={modalOptions('New goal')} />
            <Stack.Screen name="budget/limit" options={modalOptions('Budget limit')} />
            <Stack.Screen name="account/edit" options={modalOptions('Account')} />
            <Stack.Screen name="bills/new" options={modalOptions('Add a bill')} />
            <Stack.Screen name="import/sms" options={modalOptions('Import from SMS')} />
            <Stack.Screen name="debts/new" options={modalOptions('Add a debt')} />
            <Stack.Screen name="debts/pay" options={modalOptions('Record a payment')} />
            <Stack.Screen name="income/new" options={modalOptions('Add income')} />
          </Stack>
          {isLocked ? <LockScreen /> : null}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
