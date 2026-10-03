import { useEffect } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Caption } from './Typography';
import { getColors } from '@/constants/theme';
import type { SyncStatus } from '@/services/sync/sync.types';

const STATUS_META: Record<SyncStatus, { label: string; colorKey: 'text-muted' | 'accent' | 'success' | 'warning' | 'danger'; icon: keyof typeof Ionicons.glyphMap }> = {
  idle: { label: 'Not signed in', colorKey: 'text-muted', icon: 'cloud-outline' },
  syncing: { label: 'Syncing…', colorKey: 'accent', icon: 'sync' },
  synced: { label: 'Synced', colorKey: 'success', icon: 'checkmark-circle' },
  offline: { label: 'Offline', colorKey: 'warning', icon: 'cloud-offline-outline' },
  error: { label: 'Sync failed', colorKey: 'danger', icon: 'alert-circle' },
  blocked: { label: 'Sync blocked', colorKey: 'danger', icon: 'lock-closed' },
};

interface SyncStatusBadgeProps {
  status: SyncStatus;
}

/** Small status indicator so the user always knows whether their data is backed up — pulses gently while actively syncing. */
export function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
  const { colorScheme } = useColorScheme();
  const colors = getColors(colorScheme ?? 'dark');
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
      <Caption style={{ color }}>{label}</Caption>
    </View>
  );
}
