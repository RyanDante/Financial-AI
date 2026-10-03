import { Pressable, ScrollView } from 'react-native';
import { Label } from '@/components/ui';

const SUGGESTIONS = [
  "What's my balance?",
  'Where is my money going?',
  'Can I spend 100,000 on a new phone?',
  'How are my goals doing?',
  'Which subscriptions cost me the most?',
  'Forecast my balance in 6 months',
];

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-sm px-lg">
      {SUGGESTIONS.map((suggestion) => (
        <Pressable
          key={suggestion}
          onPress={() => onSelect(suggestion)}
          className="rounded-md border border-border-strong bg-surface px-md py-sm"
        >
          <Label className="text-text-primary">{suggestion}</Label>
        </Pressable>
      ))}
    </ScrollView>
  );
}
