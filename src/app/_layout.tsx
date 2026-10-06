import '../styles/global.css';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
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
import { getColors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useInterFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [displayFontsLoaded] = useSpaceGroteskFonts({ SpaceGrotesk_500Medium, SpaceGrotesk_700Bold });
  const [isDbReady, setIsDbReady] = useState(false);
  const loadAll = useFinanceStore((s) => s.loadAll);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const initializeAuth = useAuthStore((s) => s.initialize);
  const initializeSync = useSyncStore((s) => s.initialize);
  const loadTheme = useThemeStore((s) => s.loadTheme);
  const { colorScheme } = useColorScheme();
  const colors = getColors(colorScheme ?? 'dark');

  useEffect(() => {
    (async () => {
      await getDatabase();
      await Promise.all([loadAll(), loadSettings(), loadTheme()]);
      setIsDbReady(true);
    })();
    // Firebase Auth/Firestore calls here are independent of local readiness —
    // auth state restoration and sync should start as soon as possible, and
    // both already fail gracefully offline (see auth.store.ts / sync.service.ts).
    initializeAuth();
    initializeSync();
  }, [loadAll, loadSettings, loadTheme, initializeAuth, initializeSync]);

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
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="transaction/new" options={{ presentation: 'modal' }} />
            <Stack.Screen name="goal/new" options={{ presentation: 'modal' }} />
            <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
            <Stack.Screen
              name="alerts"
              options={{
                headerShown: true,
                title: 'Alerts',
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors['text-primary'],
              }}
            />
            <Stack.Screen
              name="settings"
              options={{
                headerShown: true,
                title: 'Settings',
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors['text-primary'],
              }}
            />
          </Stack>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
