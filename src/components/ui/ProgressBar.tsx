import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { cn } from '@/utils/cn';

type ProgressTone = 'accent' | 'success' | 'warning' | 'danger';

const FILL_CLASSES: Record<ProgressTone, string> = {
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

interface ProgressBarProps {
  percent: number;
  tone?: ProgressTone;
  className?: string;
}

/** A thin progress track used for budget/goal completion. Animates toward its target percent to communicate change rather than just appearing. */
export function ProgressBar({ percent, tone = 'accent', className }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(clamped, { duration: 450 });
  }, [clamped, width]);

  const animatedStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View className={cn('h-2 w-full overflow-hidden rounded-sm bg-surface-elevated', className)}>
      <Animated.View className={cn('h-full rounded-sm', FILL_CLASSES[tone])} style={animatedStyle} />
    </View>
  );
}
