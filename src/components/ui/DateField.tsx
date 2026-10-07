import { Platform, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useColorScheme } from 'nativewind';
import { useThemeColors } from '@/constants/theme';
import { Body, Label } from './Typography';
import { getLocale, useT } from '@/i18n';

interface DateFieldProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
}

/**
 * A labelled date picker that uses each platform's own UI: the system
 * dialog on Android (opened from a field-styled row) and the compact inline
 * picker on iOS. Only the date is chosen; the time of day is kept.
 */
export function DateField({ label, value, onChange, minimumDate, maximumDate }: DateFieldProps) {
  const { t } = useT();
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();

  // Keep the original time of day so editing a date doesn't move the transaction to midnight.
  const keepTime = (picked: Date) => {
    const next = new Date(value);
    next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
    onChange(next);
  };

  if (Platform.OS === 'ios') {
    return (
      <View className="flex-row items-center justify-between gap-md">
        <Label>{label}</Label>
        <DateTimePicker
          value={value}
          mode="date"
          display="compact"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          accentColor={colors.accent}
          themeVariant={colorScheme === 'light' ? 'light' : 'dark'}
          onChange={(_event, picked) => picked && keepTime(picked)}
          accessibilityLabel={label}
        />
      </View>
    );
  }

  const open = () =>
    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      minimumDate,
      maximumDate,
      onChange: (event, picked) => {
        if (event.type === 'set' && picked) keepTime(picked);
      },
    });

  return (
    <View className="gap-sm">
      <Label>{label}</Label>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={t('common.changeDate', { label, date: value.toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' }) })}
        className="min-h-[48px] flex-row items-center justify-between rounded-md border border-border-strong bg-surface px-md py-md"
      >
        <Body>{value.toLocaleDateString(getLocale(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Body>
        <Ionicons name="calendar-outline" size={18} color={colors['text-secondary']} />
      </Pressable>
    </View>
  );
}
