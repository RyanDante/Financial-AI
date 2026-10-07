import { useEffect } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Caption } from './Typography';
import { useThemeColors } from '@/constants/theme';
import type { SyncStatus } from '@/services/sync/sync.types';
import { useT, type MessageKey } from '@/i18n';

const STATUS_META: Record<SyncStatus, { label: MessageKey; colorKey: 'text-muted' | 'accent' | 'success' | 'warning' | 'danger'; icon: keyof typeof Ionicons.glyphMap }> = {
  idle: { label: 'sync.idle', colorKey: 'text-muted', icon: 'cloud-outline' },
  syncing: { label: 'sync.syncing', colorKey: 'accent', icon: 'sync' },
  synced: { label: 'sync.synced', colorKey: 'success', icon: 'checkmark-circle' },
  offline: { label: 'sync.offline', colorKey: 'warning', icon: 'cloud-offline-outline' },
  error: { label: 'sync.error', colorKey: 'danger', icon: 'alert-circle' },
  blocked: { label: 'sync.blocked', colorKey: 'danger', icon: 'lock-closed' },
};

interface SyncStatusBadgeProps {
  status: SyncStatus;
}

/** Small status indicator so the user always knows whether their data is backed up — pulses gently while actively syncing. */
export function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
  const colors = useThemeColors();
  const { t } = useT();
  const { label, colorKey, icon } = STATUS_META[status];
  const color = colors[colorKey];
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (status === 'syncing') {
      opacity.value = withRepeat(withSequence(withTiming(0.4, { duration: 500 }), withTiming(1, { duration: 500 })), -1, true);
    } else {
      opacity.value = withTiming(1, { duration: 200 });
    }
  }, [status, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View className="flex-row items-center gap-xs">
      <Animated.View style={animatedStyle}>
        <Ionicons name={icon} size={14} color={color} />
      </Animated.View>
      <Caption style={{ color }}>{t(label)}</Caption>
    </View>
  );
}
