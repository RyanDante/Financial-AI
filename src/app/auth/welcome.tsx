import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Caption, Heading } from '@/components/ui';
import { useThemeColors } from '@/constants/theme';
import { useT } from '@/i18n';

export default function WelcomeScreen() {
  const colors = useThemeColors();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 justify-between bg-background px-lg pt-lg" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
      <View className="flex-1 items-center justify-center gap-lg">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-accent-muted">
          <Ionicons name="cloud-upload-outline" size={36} color={colors.accent} />
        </View>
        <Heading className="text-center">{t('auth.welcomeTitle')}</Heading>
        <Body className="text-center text-text-secondary">
          {t('auth.welcomeBody')}
          {'\n\n'}
          {t('auth.welcomeOffline')}
        </Body>
      </View>

      <View className="gap-sm">
        <Button label={t('auth.createAccount')} onPress={() => router.push('/auth/create-account')} />
        <Button label={t('auth.signIn')} variant="secondary" onPress={() => router.push('/auth/sign-in')} />
        <Caption className="pt-sm text-center">{t('auth.withoutAccount')}</Caption>
      </View>
    </View>
  );
}
