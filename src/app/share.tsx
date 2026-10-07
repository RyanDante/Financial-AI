import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { Body, Button, Caption } from '@/components/ui';
import { useThemeColors } from '@/constants/theme';
import { getSharing } from '@/features/share/sharingModule';

const sharing = getSharing();

/**
 * Where "Share → F-AI" lands (see +native-intent.ts). Shared SMS text or a
 * screenshot goes straight to the mobile-money import, which reads it.
 */
export default function ShareScreen() {
  if (!sharing) return <Unsupported />;
  return <IncomingShare />;
}

function IncomingShare() {
  const colors = useThemeColors();
  // `sharing` is fixed for the app's lifetime, so this hook is always called.
  const { resolvedSharedPayloads, isResolving, error, clearSharedPayloads } = sharing!.useIncomingShare();

  useEffect(() => {
    if (isResolving) return;
    const image = resolvedSharedPayloads.find((p) => p.contentType === 'image' && p.contentUri)?.contentUri;
    const text = resolvedSharedPayloads
      .filter((p) => p.shareType === 'text' || p.contentType === 'text')
      .map((p) => p.value)
      .join('\n\n')
      .trim();
    if (!image && !text) return;
    clearSharedPayloads();
    router.replace({ pathname: '/import/sms', params: image ? { image } : { text } });
  }, [isResolving, resolvedSharedPayloads, clearSharedPayloads]);

  if (isResolving) {
    return (
      <View className="flex-1 items-center justify-center gap-sm bg-background">
        <ActivityIndicator color={colors['accent-secondary']} />
        <Caption>Opening what you shared…</Caption>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center gap-md bg-background p-xl">
      <Body className="text-center">{error ? "F-AI couldn't open what you shared." : 'Nothing was shared.'}</Body>
      <Caption className="text-center">Share a MoMo or Orange Money SMS (or a screenshot of one) to F-AI to import it.</Caption>
      <Button label="Go to Overview" variant="secondary" onPress={() => router.replace('/')} />
    </View>
  );
}

function Unsupported() {
  return (
    <View className="flex-1 items-center justify-center gap-md bg-background p-xl">
      <Body className="text-center">Sharing to F-AI needs the installed F-AI app (a development build), not Expo Go.</Body>
      <Button label="Import an SMS by pasting it" variant="secondary" onPress={() => router.replace('/import/sms')} />
    </View>
  );
}
