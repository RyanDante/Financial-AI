import { Pressable, ScrollView } from 'react-native';
import { Label } from '@/components/ui';
import { useT, type MessageKey } from '@/i18n';

const SUGGESTIONS: MessageKey[] = ['prompt.balance', 'prompt.whereMoney', 'prompt.phone', 'prompt.perDay', 'prompt.goals', 'prompt.subscriptions', 'prompt.forecast'];

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

/** One-tap questions, in a row pinned above the composer so they never scroll away. */
export function SuggestedPrompts({ onSelect, disabled }: SuggestedPromptsProps) {
  const { t } = useT();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerClassName="gap-sm px-lg">
      {SUGGESTIONS.map((key) => t(key)).map((suggestion) => (
        <Pressable
          key={suggestion}
          onPress={() => onSelect(suggestion)}
          disabled={disabled}
          accessibilityRole="button"
          className="rounded-full border border-border-strong bg-surface px-md py-xs"
          style={{ opacity: disabled ? 0.5 : 1 }}
        >
          <Label className="text-text-primary">{suggestion}</Label>
        </Pressable>
      ))}
    </ScrollView>
  );
}
