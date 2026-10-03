import { View } from 'react-native';
import { Body, Caption } from '@/components/ui';
import { cn } from '@/utils/cn';
import type { AIMessage } from '@/types/ai';

interface ChatBubbleProps {
  message: AIMessage;
}

/**
 * Renders a chat message. Assistant replies that cite FACT/CALCULATION/
 * PROJECTION/ASSUMPTION/INTERPRETATION lines (see
 * src/ai/agents/types.ts → buildAgentResponse, which is what every
 * specialist agent builds its reply with) get each line tagged visually,
 * so the claim-kind distinction the product spec requires is visible,
 * not just present in the text.
 */
export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const lines = message.content.split('\n');

  return (
    <View className={cn('mb-sm flex-row', isUser ? 'justify-end' : 'justify-start')}>
      <View className={cn('max-w-[85%] gap-xs rounded-lg px-lg py-md', isUser ? 'bg-accent' : 'border border-border bg-surface')}>
        {lines.map((line, index) => (
          <ChatLine key={index} line={line} isUser={isUser} />
        ))}
        {message.toolCalls && message.toolCalls.length > 0 ? (
          <Caption className={isUser ? 'text-text-primary/70' : undefined}>
            Checked: {message.toolCalls.map((tc) => tc.toolName).join(', ')}
          </Caption>
        ) : null}
      </View>
    </View>
  );
}

const LABEL_TONE: Record<string, string> = {
  'FACT:': 'text-accent-secondary',
  'CALCULATION:': 'text-text-secondary',
  'PROJECTION:': 'text-warning',
  'ASSUMPTION:': 'text-text-muted',
  'INTERPRETATION:': 'text-success',
};

function ChatLine({ line, isUser }: { line: string; isUser: boolean }) {
  const label = Object.keys(LABEL_TONE).find((prefix) => line.startsWith(prefix));
  if (label && !isUser) {
    return (
      <Body>
        <Body className={cn('font-sans-bold', LABEL_TONE[label])}>{label} </Body>
        {line.slice(label.length).trim()}
      </Body>
    );
  }
  return <Body className={isUser ? 'text-text-primary' : undefined}>{line}</Body>;
}
