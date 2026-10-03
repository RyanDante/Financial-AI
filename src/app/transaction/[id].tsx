import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AmountText, Body, Caption, Card, EmptyState, Heading, Label } from '@/components/ui';
import { AttachmentRow } from '@/components/finance/AttachmentRow';
import { transactionsRepository, fileUploadsRepository } from '@/database/repositories';
import { useFinanceStore } from '@/store/financeStore';
import { useAuthStore } from '@/features/auth/auth.store';
import { attachFileToEntity, pickDocument, pickImageFromLibrary, takePhoto } from '@/features/attachments/attachments.service';
import { retryUpload } from '@/services/cloud/storage';
import type { FileUpload } from '@/types/files';
import type { Transaction } from '@/types/finance';

const OWNER_ENTITY_TYPE = 'transaction';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { categories, accounts } = useFinanceStore();
  const authUser = useAuthStore((s) => s.user);

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [attachments, setAttachments] = useState<FileUpload[]>([]);
  const [isAttaching, setIsAttaching] = useState(false);

  const loadAttachments = useCallback(async () => {
    if (!id) return;
    setAttachments(await fileUploadsRepository.listUploadsForOwner(OWNER_ENTITY_TYPE, id));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setTransaction(await transactionsRepository.getTransactionById(id));
      await loadAttachments();
    })();
  }, [id, loadAttachments]);

  const handlePick = async (picker: () => Promise<{ uri: string; filename: string; mimeType: string | null; sizeBytes: number | null } | null>) => {
    if (!id) return;
    setIsAttaching(true);
    try {
      const file = await picker();
      if (file) {
        await attachFileToEntity(OWNER_ENTITY_TYPE, id, file, authUser?.uid ?? null);
        await loadAttachments();
      }
    } finally {
      setIsAttaching(false);
    }
  };

  const handleRetry = async (attachment: FileUpload) => {
    if (!authUser) return;
    await retryUpload(authUser.uid, attachment.id);
    await loadAttachments();
  };

  if (!transaction) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Caption>Loading…</Caption>
      </View>
    );
  }

  const category = categories.find((c) => c.id === transaction.categoryId);
  const account = accounts.find((a) => a.id === transaction.accountId);
  const isIncome = transaction.type === 'income';

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg">
      <Pressable onPress={() => router.back()} className="flex-row items-center gap-xs">
        <Ionicons name="chevron-back" size={18} color="#9D9DAB" />
        <Caption>Back</Caption>
      </Pressable>

      <View className="items-center gap-xs py-md">
        <AmountText valueMinor={isIncome ? transaction.amountMinor : -transaction.amountMinor} currency={transaction.currency} size="lg" tone={isIncome ? 'success' : 'primary'} forceSign={isIncome} />
        <Heading>{transaction.merchant || transaction.description || category?.name || 'Transaction'}</Heading>
      </View>

      <Card className="gap-sm">
        <DetailRow label="Category" value={category?.name ?? 'Uncategorized'} />
        <DetailRow label="Account" value={account?.name ?? 'Unknown'} />
        <DetailRow label="Date" value={new Date(transaction.occurredAt).toLocaleString()} />
        {transaction.notes ? <DetailRow label="Notes" value={transaction.notes} /> : null}
      </Card>

      <View className="gap-sm">
        <View className="flex-row items-center justify-between">
          <Label>Attachments</Label>
        </View>

        <Card>
          {attachments.length === 0 ? (
            <EmptyState icon="receipt-outline" title="No attachments" description="Attach a receipt or document for this transaction." />
          ) : (
            attachments.map((attachment) => <AttachmentRow key={attachment.id} attachment={attachment} onRetry={handleRetry} />)
          )}
        </Card>

        <View className="flex-row gap-sm">
          <AttachButton icon="camera-outline" label="Camera" disabled={isAttaching} onPress={() => handlePick(takePhoto)} />
          <AttachButton icon="image-outline" label="Photo" disabled={isAttaching} onPress={() => handlePick(pickImageFromLibrary)} />
          <AttachButton icon="document-outline" label="Document" disabled={isAttaching} onPress={() => handlePick(pickDocument)} />
        </View>
      </View>
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Caption>{label}</Caption>
      <Body>{value}</Body>
    </View>
  );
}

function AttachButton({ icon, label, disabled, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="flex-1 items-center gap-xs rounded-md border border-border bg-surface py-md"
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Ionicons name={icon} size={20} color="#9D9DAB" />
      <Caption>{label}</Caption>
    </Pressable>
  );
}
