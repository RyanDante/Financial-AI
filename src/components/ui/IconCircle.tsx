import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/constants/theme';
import { cn } from '@/utils/cn';

interface IconCircleProps {
  name: keyof typeof Ionicons.glyphMap;
  color?: string;
  backgroundColor?: string;
  size?: number;
  className?: string;
}

/**
 * The soft-geometric circular icon container used for category/account/goal
 * glyphs. Without a category color it falls back to the theme's neutral
 * chip colors, so it reads in both light and dark mode.
 */
export function IconCircle({ name, color, backgroundColor, size = 40, className }: IconCircleProps) {
  const colors = useThemeColors();
  return (
    <View
      className={cn('items-center justify-center rounded-full', className)}
      style={{ width: size, height: size, backgroundColor: backgroundColor ?? colors['surface-elevated'] }}
    >
      <Ionicons name={name} size={size * 0.52} color={color ?? colors['text-secondary']} />
    </View>
  );
}
