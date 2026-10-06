import { Pressable, View } from 'react-native';
import { cn } from '@/utils/cn';
import { Label } from './Typography';

export interface ChipOption<T extends string> {
  id: T;
  label: string;
}

interface ChipGroupProps<T extends string> {
  options: ChipOption<T>[];
  selectedId: T | null;
  onSelect: (id: T) => void;
}

/** A wrapping row of single-select chips (category, account, frequency). Selected = accent-muted fill + accent border. */
export function ChipGroup<T extends string>({ options, selectedId, onSelect }: ChipGroupProps<T>) {
  return (
    <View className="flex-row flex-wrap gap-sm">
      {options.map((option) => {
        const isSelected = option.id === selectedId;
        return (
          <Pressable
            key={option.id}
            onPress={() => onSelect(option.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            className={cn('min-h-[40px] justify-center rounded-sm border px-md py-sm', isSelected ? 'border-accent bg-accent-muted' : 'border-border bg-surface')}
          >
            <Label className={isSelected ? 'text-accent-secondary' : undefined}>{option.label}</Label>
          </Pressable>
        );
      })}
    </View>
  );
}
