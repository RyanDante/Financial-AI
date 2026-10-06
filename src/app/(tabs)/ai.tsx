import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui';
import { useAppBarHeight } from '@/components/ui/AppBar';
import { useThemeColors } from '@/constants/theme';
import { ChatBubble } from '@/components/ai/ChatBubble';
import { SuggestedPrompts } from '@/components/ai/SuggestedPrompts';
import { useAIStore } from '@/store/aiStore';

export default function AIScreen() {
  const appBarHeight = useAppBarHeight();
  const colors = useThemeColors();
  const { messages, isSending, ensureConversation, sendMessage } = useAIStore();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    ensureConversation();
  }, [ensureConversation]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const handleSend = async (text: string) => {
    setDraft('');
    await sendMessage(text);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? appBarHeight : 0}
    >
      <ScreenHeader title="F-AI Copilot" subtitle="Ask about your money — I only use your real data." />

      <ScrollView ref={scrollRef} className="flex-1 px-lg" contentContainerClassName="pb-lg">
        {messages.length === 0 ? (
          <View className="py-xl">
            <SuggestedPrompts onSelect={handleSend} />
          </View>
        ) : (
          messages
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((message) => <ChatBubble key={message.id} message={message} />)
        )}
      </ScrollView>

      <View className="flex-row items-center gap-sm border-t border-border bg-surface px-lg py-md">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask about your finances…"
          placeholderTextColor={colors['text-muted']}
          className="flex-1 rounded-md border border-border-strong bg-background px-md py-sm text-text-primary"
          onSubmitEditing={() => draft.trim() && handleSend(draft)}
          editable={!isSending}
        />
        <Pressable
          onPress={() => draft.trim() && handleSend(draft)}
          disabled={isSending || !draft.trim()}
          className="rounded-full bg-accent p-sm"
          style={{ opacity: isSending || !draft.trim() ? 0.5 : 1 }}
        >
          <Ionicons name="arrow-up" size={20} color={colors['on-accent']} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
