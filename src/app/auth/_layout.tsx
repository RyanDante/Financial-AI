import { Stack } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { getColors } from '@/constants/theme';

export default function AuthLayout() {
  const { colorScheme } = useColorScheme();
  const colors = getColors(colorScheme ?? 'dark');

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors['text-primary'],
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="welcome" options={{ title: '' }} />
      <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
      <Stack.Screen name="create-account" options={{ title: 'Create account' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
    </Stack>
  );
}
