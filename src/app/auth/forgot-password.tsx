import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Body, Button, Caption, Label } from '@/components/ui';
import { useAuthStore } from '@/features/auth/auth.store';

export default function ForgotPasswordScreen() {
  const { resetPassword, error } = useAuthStore();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch {
      // error is already set on the store.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg">
      <Body className="text-text-secondary">Enter your account email and we&apos;ll send you a link to reset your password.</Body>

      <View className="gap-sm">
        <Label>Email</Label>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="you@example.com"
          placeholderTextColor="#6B6B78"
          className="rounded-md border border-border-strong bg-surface px-md py-md text-text-primary"
        />
      </View>

      {error ? <Caption className="text-danger">{error}</Caption> : null}
      {sent ? <Caption className="text-success">Check your email for a reset link.</Caption> : null}

      <Button label={isSubmitting ? 'Sending…' : 'Send reset link'} onPress={handleSubmit} disabled={isSubmitting || !email} />
    </ScrollView>
  );
}
