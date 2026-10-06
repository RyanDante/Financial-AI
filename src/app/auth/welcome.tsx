import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Body, Button, Caption, Heading } from '@/components/ui';
import { useThemeColors } from '@/constants/theme';

export default function WelcomeScreen() {
  const colors = useThemeColors();
  return (
    <View className="flex-1 justify-between bg-background p-lg">
      <View className="flex-1 items-center justify-center gap-lg">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-accent-muted">
          <Ionicons name="cloud-upload-outline" size={36} color={colors.accent} />
        </View>
        <Heading className="text-center">Back up & sync your data</Heading>
        <Body className="text-center text-text-secondary">
          Sign in to keep your accounts, transactions, budgets, and goals backed up and available on other devices.
          {'\n\n'}
          F-AI works fully offline either way — signing in only adds cloud backup and sync on top.
        </Body>
      </View>

      <View className="gap-sm">
        <Button label="Create account" onPress={() => router.push('/auth/create-account')} />
        <Button label="Sign in" variant="secondary" onPress={() => router.push('/auth/sign-in')} />
        <Caption className="pt-sm text-center">You can keep using F-AI without an account.</Caption>
      </View>
    </View>
  );
}
