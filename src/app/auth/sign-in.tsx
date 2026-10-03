import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Link, router } from 'expo-router';
import { Body, Button, Caption, Label } from '@/components/ui';
import { useAuthStore } from '@/features/auth/auth.store';

export default function SignInScreen() {
  const { signIn, error } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await signIn(email.trim(), password);
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
          autoComplete="password"
          placeholder="••••••••"
          placeholderTextColor="#6B6B78"
          className="rounded-md border border-border-strong bg-surface px-md py-md text-text-primary"
        />
      </View>

      {error ? <Caption className="text-danger">{error}</Caption> : null}

      <Button label={isSubmitting ? 'Signing in…' : 'Sign in'} onPress={handleSubmit} disabled={isSubmitting || !email || !password} />

      <Link href="/auth/forgot-password" asChild>
        <Body className="text-center text-accent-secondary">Forgot your password?</Body>
      </Link>
    </ScrollView>
  );
}
