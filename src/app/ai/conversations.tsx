import { useEffect } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Body, Button, Caption, EmptyState } from '@/components/ui';
import { useThemeColors } from '@/constants/theme';
import { useAIStore } from '@/store/aiStore';
import { cn } from '@/utils/cn';
import type { AIConversation } from '@/types/ai';

/** Past copilot chats: open one to continue it, or delete it. */
export default function ConversationsScreen() {
  const { conversations, conversationId, loadConversations, openConversation, deleteConversation, newChat } = useAIStore();

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const open = async (id: string) => {
    await openConversation(id);
    router.back();
  };

  const confirmDelete = (conversation: AIConversation) => {
    Alert.alert('Delete this chat?', conversation.title ?? 'Untitled chat', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteConversation(conversation.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-sm p-lg pb-3xl">
      <Button
        label="New chat"
        onPress={() => {
          newChat();
          router.back();
        }}
      />
      {conversations.length === 0 ? (
        <EmptyState icon="chatbubbles-outline" title="No chats yet" description="Your questions to the copilot are kept here, on this phone." />
      ) : (
        conversations.map((conversation) => (
          <ConversationRow
            key={conversation.id}
            conversation={conversation}
            isCurrent={conversation.id === conversationId}
            onOpen={() => open(conversation.id)}
            onDelete={() => confirmDelete(conversation)}
          />
        ))
      )}
    </ScrollView>
  );
}

function ConversationRow({ conversation, isCurrent, onOpen, onDelete }: { conversation: AIConversation; isCurrent: boolean; onOpen: () => void; onDelete: () => void }) {
  const colors = useThemeColors();
  const updated = new Date(conversation.updatedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <View className={cn('flex-row items-center rounded-md border bg-surface', isCurrent ? 'border-accent' : 'border-border')}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Open chat: ${conversation.title ?? 'Untitled chat'}`} className="flex-1 gap-xs p-md">
        <Body numberOfLines={1}>{conversation.title ?? 'Untitled chat'}</Body>
        <Caption>{isCurrent ? `Open now · ${updated}` : updated}</Caption>
      </Pressable>
      <Pressable onPress={onDelete} accessibilityRole="button" accessibilityLabel="Delete chat" hitSlop={4} className="h-11 w-11 items-center justify-center">
        <Ionicons name="trash-outline" size={20} color={colors['text-muted']} />
      </Pressable>
    </View>
  );
}
