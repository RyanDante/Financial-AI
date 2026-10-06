import { Pressable } from 'react-native';
import { router, type NativeStackNavigationOptions } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/constants/theme';

/**
 * The one header style for every page that isn't a tab (ui.md §17): pushed
 * pages and modals use the platform's native header, so the status bar, the
 * notch, iOS sheet modals and the back gesture are all handled for us. Tabs
 * use AppBar instead; both are flat on `background` so they read as one
 * system. No screen draws its own title row or back button.
 */
export function usePageHeaderOptions(): NativeStackNavigationOptions {
  const colors = useThemeColors();
  return {
    headerShown: true,
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors['text-primary'],
    headerTitleStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 17 },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
    contentStyle: { backgroundColor: colors.background },
  };
}

/** Options for a modal: same header, with a Close button where Back would be. */
export function modalOptions(title: string): NativeStackNavigationOptions {
  return { presentation: 'modal', title, headerLeft: () => <CloseButton /> };
}

/** Dismisses the current modal. 44×44 target, labelled for screen readers. */
export function CloseButton() {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={8}
      className="h-11 w-11 items-start justify-center"
    >
      <Ionicons name="close" size={24} color={colors['text-primary']} />
    </Pressable>
  );
}
