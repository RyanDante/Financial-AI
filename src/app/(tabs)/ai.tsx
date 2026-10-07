import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Body, Caption, ScreenHeader } from '@/components/ui';
import { aiStatus, providerLabel } from '@/ai';
import { useAppBarHeight } from '@/components/ui/AppBar';
import { KeyboardAvoider } from '@/components/keyboard/keyboard';
import { useThemeColors } from '@/constants/theme';
import { ChatBubble } from '@/components/ai/ChatBubble';
import { SuggestedPrompts } from '@/components/ai/SuggestedPrompts';
import { useAIStore, type ChatMessage } from '@/store/aiStore';

/** How far above the newest message the user must scroll before "Latest" appears. */
const SHOW_LATEST_AFTER = 250;

/** Hiding the prompt pills lasts until the app restarts. */
let promptsHiddenThisSession = false;

export default function AIScreen() {
  const appBarHeight = useAppBarHeight();
  const colors = useThemeColors();
  const { messages, isSending, step, load, sendMessage, retry, newChat } = useAIStore();
  const [draft, setDraft] = useState('');
  const [distanceFromEnd, setDistanceFromEnd] = useState(0);
  const [promptsHidden, setPromptsHidden] = useState(promptsHiddenThisSession);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const isNearEnd = distanceFromEnd < SHOW_LATEST_AFTER;

  const visible = useMemo(() => messages.filter((m) => m.role === 'user' || m.role === 'assistant'), [messages]);

  useEffect(() => {
    load();
  }, [load]);

  // A new message always brings the user to it.
  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [visible.length]);

  const onScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    setDistanceFromEnd(Math.max(0, contentSize.height - layoutMeasurement.height - contentOffset.y));
  };

  const send = (text: string) => {
    if (!text.trim() || isSending) return;
    setDraft('');
    sendMessage(text);
  };

  const togglePrompts = () => {
    promptsHiddenThisSession = !promptsHidden;
    setPromptsHidden(promptsHiddenThisSession);
    Haptics.selectionAsync();
  };

  const startNewChat = () => {
    newChat();
    setDraft('');
    Haptics.selectionAsync();
  };

  return (
    <KeyboardAvoider className="flex-1 bg-background" keyboardVerticalOffset={appBarHeight}>
      <ScreenHeader
        title="F-AI Copilot"
        subtitle="Ask about your money — I only use your real data."
        right={
          <View className="flex-row gap-xs">
            <HeaderButton icon="chatbubbles-outline" label="Your chats" onPress={() => router.push('/ai/conversations')} />
            <HeaderButton icon="create-outline" label="New chat" onPress={startNewChat} disabled={isSending} />
          </View>
        }
      />

      <View className="flex-1">
        <FlatList
          ref={listRef}
          data={visible}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <ChatBubble message={item} onRetry={retry} />}
          className="flex-1"
          contentContainerClassName="flex-grow px-lg pb-lg"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onScroll={onScroll}
          scrollEventThrottle={64}
          onContentSizeChange={() => {
            if (isNearEnd) listRef.current?.scrollToEnd({ animated: false });
          }}
          ListHeaderComponent={
            <Caption className="pb-md">
              {aiStatus.provider === 'mock'
                ? 'Offline copilot: answers come from built-in rules on this phone.'
                : `Answers by ${providerLabel()}. Your question and the figures it needs are sent to ${providerLabel()}.`}
            </Caption>
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center gap-sm py-xl">
              <Ionicons name="sparkles-outline" size={28} color={colors['accent-secondary']} />
              <Body className="text-center">Ask anything about your balance, spending, bills, debts or goals.</Body>
              <Caption className="text-center">Tap a question below to start.</Caption>
            </View>
          }
          ListFooterComponent={
            isSending ? (
              <View className="flex-row items-center gap-sm py-sm" accessibilityLiveRegion="polite">
                <ActivityIndicator size="small" color={colors['accent-secondary']} />
                <Caption>{step ?? 'Thinking…'}</Caption>
              </View>
            ) : null
          }
        />

        {!isNearEnd ? (
          <Pressable
            onPress={() => listRef.current?.scrollToEnd({ animated: true })}
            accessibilityRole="button"
            accessibilityLabel="Scroll to the latest message"
            className="absolute bottom-md right-lg h-10 w-10 items-center justify-center rounded-full border border-border-strong bg-surface"
            style={{ elevation: 3, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}
          >
            <Ionicons name="arrow-down" size={20} color={colors['text-primary']} />
          </Pressable>
        ) : null}
      </View>

      <View className="border-t border-border bg-surface pt-sm">
        <View className="flex-row items-center">
          <View className="flex-1">{promptsHidden ? <Caption className="px-lg">Suggested questions hidden</Caption> : <SuggestedPrompts onSelect={send} disabled={isSending} />}</View>
          <Pressable
            onPress={togglePrompts}
            accessibilityRole="button"
            accessibilityLabel={promptsHidden ? 'Show suggested questions' : 'Hide suggested questions'}
            hitSlop={8}
            className="h-8 w-10 items-center justify-center"
          >
            <Ionicons name={promptsHidden ? 'chevron-up' : 'chevron-down'} size={18} color={colors['text-muted']} />
          </Pressable>
        </View>

        <View className="flex-row items-end gap-sm px-lg py-sm">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask about your finances…"
            placeholderTextColor={colors['text-muted']}
            multiline
            textAlignVertical="center"
            accessibilityLabel="Your question"
            className="max-h-[112px] min-h-[44px] flex-1 rounded-md border border-border-strong bg-background px-md py-sm text-text-primary"
          />
          <Pressable
            onPress={() => send(draft)}
            disabled={isSending || !draft.trim()}
            accessibilityRole="button"
            accessibilityLabel="Send"
            className="h-11 w-11 items-center justify-center rounded-full bg-accent"
            style={{ opacity: isSending || !draft.trim() ? 0.5 : 1 }}
          >
            <Ionicons name="arrow-up" size={20} color={colors['on-accent']} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoider>
  );
}

function HeaderButton({ icon, label, onPress, disabled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean }) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      className="h-10 w-10 items-center justify-center rounded-full border border-border bg-surface"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Ionicons name={icon} size={20} color={colors['text-primary']} />
    </Pressable>
  );
}
