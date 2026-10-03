import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cn } from '@/utils/cn';

interface IconCircleProps {
  name: keyof typeof Ionicons.glyphMap;
  color?: string;
  backgroundColor?: string;
  size?: number;
  className?: string;
}

/** The soft-geometric circular icon container used for category/account/goal glyphs. */
export function IconCircle({ name, color = '#F5F5F7', backgroundColor = '#2A2A34', size = 40, className }: IconCircleProps) {
  return (
    <View
      className={cn('items-center justify-center rounded-full', className)}
      style={{ width: size, height: size, backgroundColor }}
    >
      <Ionicons name={name} size={size * 0.52} color={color} />
    </View>
  );
}
