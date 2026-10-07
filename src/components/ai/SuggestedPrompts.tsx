import { Pressable, ScrollView } from 'react-native';
import { Label } from '@/components/ui';

const SUGGESTIONS = [
  "What's my balance?",
  'Where is my money going?',
  'Can I spend 100,000 on a new phone?',
  'How much can I spend per day until payday?',
  'How are my goals doing?',
  'Which subscriptions cost me the most?',
  'Forecast my balance in 6 months',
];

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

/** One-tap questions, in a row pinned above the composer so they never scroll away. */
export function SuggestedPrompts({ onSelect, disabled }: SuggestedPromptsProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerClassName="gap-sm px-lg">
      {SUGGESTIONS.map((suggestion) => (
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
