import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppLockStore } from '@/features/security/appLock.store';
import { useThemeColors } from '@/constants/theme';
import { Body } from './Typography';
import { Button } from './Button';
import { useT } from '@/i18n';

/**
 * Covers the whole app while it's locked: nothing financial is visible
 * behind it. Asks for authentication as soon as it appears; "Unlock"
 * asks again if the user cancelled.
 */
export function LockScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const unlock = useAppLockStore((s) => s.unlock);
  const { t } = useT();
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    unlock();
  }, [unlock]);

  return (
    <View
      className="absolute inset-0 items-center justify-center gap-lg bg-background px-xl"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      accessibilityViewIsModal
    >
      <View className="h-20 w-20 items-center justify-center rounded-full bg-accent-muted">
        <Ionicons name="lock-closed" size={32} color={colors.accent} />
      </View>
      <Text accessibilityRole="header" className="font-display text-[28px] leading-[32px] text-text-primary">
        F-AI is locked
      </Text>
      <Body className="text-center text-text-secondary">{t('lock.message')}</Body>
      <Button label={t('lock.unlock')} className="self-stretch" onPress={() => unlock()} />
    </View>
  );
}
