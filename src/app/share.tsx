import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { Body, Button, Caption } from '@/components/ui';
import { useThemeColors } from '@/constants/theme';
import { getSharing } from '@/features/share/sharingModule';
import { useT } from '@/i18n';

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
  const { t } = useT();
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
        <Caption>{t('share.opening')}</Caption>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center gap-md bg-background p-xl">
      <Body className="text-center">{error ? t('share.failed') : t('share.nothing')}</Body>
      <Caption className="text-center">{t('share.hint')}</Caption>
      <Button label={t('common.goToOverview')} variant="secondary" onPress={() => router.replace('/')} />
    </View>
  );
}

function Unsupported() {
  const { t } = useT();
  return (
    <View className="flex-1 items-center justify-center gap-md bg-background p-xl">
      <Body className="text-center">{t('share.unsupported')}</Body>
      <Button label={t('share.paste')} variant="secondary" onPress={() => router.replace('/import/sms')} />
    </View>
  );
}
