import { Stack } from 'expo-router';
import { CloseButton, usePageHeaderOptions } from '@/components/navigation/pageHeader';

export default function AuthLayout() {
  const pageHeaderOptions = usePageHeaderOptions();

  return (
    <Stack screenOptions={pageHeaderOptions}>
      {/* The flow opens as a modal; its first page closes it, the rest go back. */}
      <Stack.Screen name="welcome" options={{ title: '', headerLeft: () => <CloseButton /> }} />
      <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
      <Stack.Screen name="create-account" options={{ title: 'Create account' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
    </Stack>
  );
}
