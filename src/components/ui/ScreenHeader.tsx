import { View } from 'react-native';
import { Heading, Label } from './Typography';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, right }: ScreenHeaderProps) {
  return (
    <View className="flex-row items-start justify-between px-lg pb-md pt-xl">
      <View>
        <Heading>{title}</Heading>
        {subtitle ? <Label className="mt-xs">{subtitle}</Label> : null}
      </View>
      {right}
    </View>
  );
}
