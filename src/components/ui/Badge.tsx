import { View } from 'react-native';
import { Caption } from './Typography';
import { cn } from '@/utils/cn';

type BadgeTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

const TONE_CLASSES: Record<BadgeTone, string> = {
  accent: 'bg-accent-muted',
  success: 'bg-success-muted',
  warning: 'bg-warning-muted',
  danger: 'bg-danger-muted',
  neutral: 'bg-surface-elevated',
};

const TEXT_CLASSES: Record<BadgeTone, string> = {
  accent: 'text-accent-secondary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-text-secondary',
};

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  className?: string;
}

export function Badge({ label, tone = 'neutral', className }: BadgeProps) {
  return (
    <View className={cn('self-start rounded-sm px-sm py-xs', TONE_CLASSES[tone], className)}>
      <Caption className={cn('font-sans-medium', TEXT_CLASSES[tone])}>{label}</Caption>
    </View>
  );
}
