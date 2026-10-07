import { ActionSheetIOS, Alert, Platform, Pressable, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Badge, Body, Caption } from '@/components/ui';
import { cn } from '@/utils/cn';
import { extractAgentName, visibleToolCalls } from '@/types/ai';
import type { ChatMessage } from '@/store/aiStore';
import { useT, type MessageKey } from '@/i18n';

interface ChatBubbleProps {
  message: ChatMessage;
  onRetry?: (messageId: string) => void;
}

/**
 * Renders a chat message. Assistant replies that cite FACT/CALCULATION/
 * PROJECTION/ASSUMPTION/INTERPRETATION lines (see
 * src/ai/agents/types.ts → buildAgentResponse, which is what every
 * specialist agent builds its reply with) get each line tagged visually,
 * so the claim-kind distinction the product spec requires is visible,
 * not just present in the text.
 *
 * A subtle badge names which specialist handled the message (see
 * docs/AI_ARCHITECTURE.md "UI routing visibility") — just the agent's
 * display name and the tools it actually checked, never the regex/intent
 * logic, a raw tool schema, or anything resembling internal reasoning.
 */
export function ChatBubble({ message, onRetry }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const failed = message.status === 'failed';
  const { t } = useT();

  const showActions = () => {
    Haptics.selectionAsync();
    const copy = () => Clipboard.setStringAsync(message.content);
    const retry = failed && onRetry ? () => onRetry(message.id) : null;
    if (Platform.OS === 'ios') {
      const options = retry ? [t('ai.copy'), t('ai.sendAgain'), t('common.cancel')] : [t('ai.copy'), t('common.cancel')];
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: options.length - 1 }, (index) => {
        if (index === 0) copy();
        else if (index === 1 && retry) retry();
      });
      return;
    }
    Alert.alert(t('ai.message'), undefined, [
      { text: t('ai.copy'), onPress: copy },
      ...(retry ? [{ text: t('ai.sendAgain'), onPress: retry }] : []),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };
  const lines = message.content.split('\n');
  const agentName = extractAgentName(message.toolCalls);
  const checkedTools = visibleToolCalls(message.toolCalls);

  return (
    <View className={cn('mb-sm', isUser ? 'items-end' : 'items-start')}>
      <Pressable
        onLongPress={showActions}
        delayLongPress={350}
        accessibilityHint={t('ai.longPressHint')}
        className={cn('max-w-[85%] gap-xs rounded-lg px-lg py-md', isUser ? 'bg-accent' : 'border border-border bg-surface')}
        style={{ opacity: message.status === 'sending' ? 0.7 : 1 }}
      >
        {agentName ? <Badge label={agentName} tone="accent" className="mb-xs" /> : null}
        {lines.map((line, index) => (
          <ChatLine key={index} line={line} isUser={isUser} />
        ))}
        {checkedTools.length > 0 ? (
          <Caption className={isUser ? 'text-on-accent/70' : undefined}>{t('ai.checked', { tools: checkedTools.map((tc) => tc.toolName).join(', ') })}</Caption>
        ) : null}
      </Pressable>
      {failed ? (
        <Pressable onPress={() => onRetry?.(message.id)} accessibilityRole="button" hitSlop={8} className="mt-xs min-h-[32px] justify-center">
          <Caption className="text-danger">{t('ai.notSent')}</Caption>
        </Pressable>
      ) : null}
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
  const { t } = useT();
  const label = Object.keys(LABEL_TONE).find((prefix) => line.startsWith(prefix));
  if (label && !isUser) {
    return (
      <Body>
        <Body className={cn('font-sans-bold', LABEL_TONE[label])}>{t(`ai.label.${label.slice(0, -1)}` as MessageKey)} </Body>
        {line.slice(label.length).trim()}
      </Body>
    );
  }
  return <Body className={isUser ? 'text-on-accent' : undefined}>{line}</Body>;
}
