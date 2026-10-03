import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Caption, Label } from '@/components/ui';
import { useAuthStore } from '@/features/auth/auth.store';

export default function CreateAccountScreen() {
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
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg">
      <View className="gap-sm">
        <Label>Name (optional)</Label>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your name"
          placeholderTextColor="#6B6B78"
          className="rounded-md border border-border-strong bg-surface px-md py-md text-text-primary"
        />
      </View>

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

      <View className="gap-sm">
        <Label>Password</Label>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          placeholder="At least 6 characters"
          placeholderTextColor="#6B6B78"
          className="rounded-md border border-border-strong bg-surface px-md py-md text-text-primary"
        />
      </View>

      {error ? <Caption className="text-danger">{error}</Caption> : null}

      <Button
        label={isSubmitting ? 'Creating account…' : 'Create account'}
        onPress={handleSubmit}
        disabled={isSubmitting || !email || password.length < 6}
      />
    </ScrollView>
  );
}
