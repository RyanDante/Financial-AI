import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { getColors } from '@/constants/theme';
import { AppBar } from '@/components/ui/AppBar';

const TAB_BAR_CONTENT_HEIGHT = 58;

export default function TabsLayout() {
  // Android devices with on-screen gesture/nav buttons report a non-zero bottom
  // inset that the tab bar must add as padding, or those buttons sit on top of
  // (and can hide) the tab labels. iOS already needs this for the home indicator.
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);
  const { colorScheme } = useColorScheme();
  const colors = getColors(colorScheme ?? 'dark');

  return (
    <Tabs
      screenOptions={{
        // One fixed AppBar above every tab: it owns the top safe-area inset.
        headerShown: true,
        header: () => <AppBar />,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors['text-muted'],
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset,
        },
        tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="transactions"
        options={{ title: 'Transactions', tabBarIcon: ({ color, size }) => <Ionicons name="swap-vertical" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="budgets"
        options={{ title: 'Budgets', tabBarIcon: ({ color, size }) => <Ionicons name="pie-chart" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="goals"
        options={{ title: 'Goals', tabBarIcon: ({ color, size }) => <Ionicons name="flag" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="ai"
        options={{ title: 'AI', tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
