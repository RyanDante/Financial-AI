import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/constants/theme';
import { useAlerts } from '@/features/alerts/useAlerts';

const BAR_HEIGHT = 52;
const ICON_HIT_SLOP = { top: 4, bottom: 4, left: 4, right: 4 };

/** Total height the AppBar occupies, for KeyboardAvoidingView offsets on screens below it. */
export function useAppBarHeight(): number {
  return useSafeAreaInsets().top + BAR_HEIGHT;
}

/**
 * The fixed bar above every tab screen (ui.md §17): the app name, the alerts
 * bell and settings. It owns the top safe-area inset, so screens below it
 * never sit under the status bar or notch; ScreenHeader no longer pads for it.
 */
export function AppBar() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const alertCount = useAlerts().length;

  const go = (href: '/alerts' | '/settings') => {
    Haptics.selectionAsync();
    router.push(href);
  };

  return (
    <View className="bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-lg" style={{ height: BAR_HEIGHT }}>
        <Text accessibilityRole="header" className="font-display text-[20px] leading-[24px] text-text-primary">
          F-AI
        </Text>
        <View className="flex-row items-center gap-xs">
          <Pressable
            onPress={() => go('/alerts')}
            hitSlop={ICON_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={alertCount > 0 ? `Alerts, ${alertCount} need${alertCount === 1 ? 's' : ''} attention` : 'Alerts, none'}
            className="h-11 w-11 items-center justify-center rounded-full"
          >
            <Ionicons name="notifications-outline" size={22} color={colors['text-secondary']} />
            {alertCount > 0 ? <View className="absolute right-[10px] top-[10px] h-2 w-2 rounded-full bg-danger" /> : null}
          </Pressable>
          <Pressable
            onPress={() => go('/settings')}
            hitSlop={ICON_HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            className="h-11 w-11 items-center justify-center rounded-full"
          >
            <Ionicons name="settings-outline" size={22} color={colors['text-secondary']} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
