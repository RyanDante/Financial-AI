import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/constants/theme';
import { currentMonthKey, formatMonthLabel, shiftMonth } from '@/utils/months';
import { Title } from './Typography';
import { useT } from '@/i18n';

interface MonthStepperProps {
  month: string;
  onChange: (month: string) => void;
}

/** ‹ September 2026 ›: steps back through past months; never forward past the current one. */
export function MonthStepper({ month, onChange }: MonthStepperProps) {
  const colors = useThemeColors();
  const isCurrent = month >= currentMonthKey();
  const { t } = useT();

  const step = (delta: number) => {
    Haptics.selectionAsync();
    onChange(shiftMonth(month, delta));
  };

  return (
    <View className="flex-row items-center justify-between">
      <Pressable onPress={() => step(-1)} accessibilityRole="button" accessibilityLabel={t('common.previousMonth')} className="h-11 w-11 items-center justify-center rounded-full">
        <Ionicons name="chevron-back" size={20} color={colors['text-primary']} />
      </Pressable>
      <Title accessibilityRole="header" accessibilityLiveRegion="polite">
        {formatMonthLabel(month)}
      </Title>
      <Pressable
        onPress={() => step(1)}
        disabled={isCurrent}
        accessibilityRole="button"
        accessibilityLabel={t('common.nextMonth')}
        accessibilityState={{ disabled: isCurrent }}
        className="h-11 w-11 items-center justify-center rounded-full"
        style={{ opacity: isCurrent ? 0.3 : 1 }}
      >
        <Ionicons name="chevron-forward" size={20} color={colors['text-primary']} />
      </Pressable>
    </View>
  );
}
