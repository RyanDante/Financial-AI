import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, Label } from './Typography';
import { useThemeColors } from '@/constants/theme';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  const colors = useThemeColors();
  return (
    <View className="items-center justify-center gap-sm px-xl py-2xl">
      <Ionicons name={icon} size={32} color={colors['text-muted']} />
      <Body className="text-center text-text-secondary">{title}</Body>
      {description ? <Label className="text-center">{description}</Label> : null}
    </View>
  );
}
