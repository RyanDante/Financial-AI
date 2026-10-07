import { Stack } from 'expo-router';
import { CloseButton, usePageHeaderOptions } from '@/components/navigation/pageHeader';
import { useT } from '@/i18n';

export default function AuthLayout() {
  const pageHeaderOptions = usePageHeaderOptions();
  const { t } = useT();

  return (
    <Stack screenOptions={pageHeaderOptions}>
      {/* The flow opens as a modal; its first page closes it, the rest go back. */}
      <Stack.Screen name="welcome" options={{ title: '', headerLeft: () => <CloseButton /> }} />
      <Stack.Screen name="sign-in" options={{ title: t('auth.signIn') }} />
      <Stack.Screen name="create-account" options={{ title: t('auth.createAccount') }} />
      <Stack.Screen name="forgot-password" options={{ title: t('auth.resetPassword') }} />
    </Stack>
  );
}
