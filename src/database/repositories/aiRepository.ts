import * as Crypto from 'expo-crypto';
import { getDatabase } from '../client';
import type { AIConversation, AIMessage, AIMessageRole } from '@/types/ai';

interface ConversationRow {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: AIMessageRole;
  content: string;
  tool_calls_json: string | null;
  created_at: string;
}

function mapConversation(row: ConversationRow): AIConversation {
  return { id: row.id, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at };
}

function mapMessage(row: MessageRow): AIMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    toolCalls: row.tool_calls_json ? JSON.parse(row.tool_calls_json) : null,
    createdAt: row.created_at,
  };
}

export async function listConversations(): Promise<AIConversation[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ConversationRow>(
    'SELECT * FROM ai_conversations WHERE deleted_at IS NULL ORDER BY updated_at DESC',
  );
  return rows.map(mapConversation);
}

export async function createConversation(title?: string | null): Promise<AIConversation> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO ai_conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
    id,
    title ?? null,
    now,
    now,
  );
  return { id, title: title ?? null, createdAt: now, updatedAt: now };
}

export async function listMessages(conversationId: string): Promise<AIMessage[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<MessageRow>(
    'SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC',
    conversationId,
  );
  return rows.map(mapMessage);
}

export async function addMessage(
  conversationId: string,
  role: AIMessageRole,
  content: string,
  toolCalls?: unknown,
): Promise<AIMessage> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO ai_messages (id, conversation_id, role, content, tool_calls_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    conversationId,
    role,
    content,
    toolCalls ? JSON.stringify(toolCalls) : null,
    now,
  );
  await db.runAsync('UPDATE ai_conversations SET updated_at = ? WHERE id = ?', now, conversationId);
  return { id, conversationId, role, content, toolCalls: (toolCalls as AIMessage['toolCalls']) ?? null, createdAt: now };
}
