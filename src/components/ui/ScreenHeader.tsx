import { View } from 'react-native';
import { Heading, Label } from './Typography';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

/**
 * The screen's title row, scrolling with its content. It sits below the
 * fixed AppBar, which owns the top safe-area inset, so it only needs `pt-md`.
 */
export function ScreenHeader({ title, subtitle, right }: ScreenHeaderProps) {
  return (
    <View className="flex-row items-start justify-between px-lg pb-md pt-md">
      <View className="flex-1">
        <Heading>{title}</Heading>
        {subtitle ? <Label className="mt-xs">{subtitle}</Label> : null}
      </View>
      {right}
    </View>
  );
}
