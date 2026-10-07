import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Caption, Label } from '@/components/ui';
import { useAuthStore } from '@/features/auth/auth.store';
import { useThemeColors } from '@/constants/theme';
import { FormScrollView } from '@/components/keyboard/keyboard';
import { useT } from '@/i18n';

export default function CreateAccountScreen() {
  const colors = useThemeColors();
  const { t } = useT();
  const { signUp, error } = useAuthStore();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await signUp(email.trim(), password, displayName.trim() || undefined);
      router.replace('/settings');
    } catch {
      // error is already set on the store; swallow here so the UI stays on this screen.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg">
      <View className="gap-sm">
        <Label>{t('auth.nameOptional')}</Label>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t('auth.namePlaceholder')}
          placeholderTextColor={colors['text-muted']}
          className="rounded-md border border-border-strong bg-surface px-md py-md text-text-primary"
        />
      </View>

      <View className="gap-sm">
        <Label>{t('auth.email')}</Label>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="you@example.com"
          placeholderTextColor={colors['text-muted']}
          className="rounded-md border border-border-strong bg-surface px-md py-md text-text-primary"
        />
      </View>

      <View className="gap-sm">
        <Label>{t('auth.password')}</Label>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          placeholder={t('auth.passwordPlaceholder')}
          placeholderTextColor={colors['text-muted']}
          className="rounded-md border border-border-strong bg-surface px-md py-md text-text-primary"
        />
      </View>

      {error ? <Caption className="text-danger">{error}</Caption> : null}

      <Button
        label={isSubmitting ? t('auth.creating') : t('auth.createAccount')}
        onPress={handleSubmit}
        disabled={isSubmitting || !email || password.length < 6}
      />
    </FormScrollView>
  );
}
