import { Image, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, Caption } from '@/components/ui';
import { getUploadStatusLabel, isImageAttachment } from '@/features/attachments/attachments.mapper';
import type { FileUpload } from '@/types/files';

const STATUS_COLOR: Record<FileUpload['status'], string> = {
  pending: '#9D9DAB',
  uploaded: '#3FC98B',
  failed: '#F2545B',
};

const STATUS_ICON: Record<FileUpload['status'], keyof typeof Ionicons.glyphMap> = {
  pending: 'time-outline',
  uploaded: 'cloud-done-outline',
  failed: 'alert-circle-outline',
};

interface AttachmentRowProps {
  attachment: FileUpload;
  onRetry?: (attachment: FileUpload) => void;
}

/** One attachment on a transaction: a thumbnail (if it's an image, always from the local file so it's viewable offline), filename, and upload status. */
export function AttachmentRow({ attachment, onRetry }: AttachmentRowProps) {
  return (
    <View className="flex-row items-center gap-md py-sm">
      {isImageAttachment(attachment.mimeType) ? (
        <Image source={{ uri: attachment.localUri }} className="h-10 w-10 rounded-sm" />
      ) : (
        <View className="h-10 w-10 items-center justify-center rounded-sm bg-surface-elevated">
          <Ionicons name="document-text-outline" size={20} color="#9D9DAB" />
        </View>
      )}

      <View className="flex-1">
        <Body numberOfLines={1}>{attachment.filename}</Body>
        <View className="flex-row items-center gap-xs">
          <Ionicons name={STATUS_ICON[attachment.status]} size={12} color={STATUS_COLOR[attachment.status]} />
          <Caption style={{ color: STATUS_COLOR[attachment.status] }}>{getUploadStatusLabel(attachment.status)}</Caption>
        </View>
      </View>

      {attachment.status === 'failed' && onRetry ? (
        <Pressable onPress={() => onRetry(attachment)}>
          <Caption className="text-accent-secondary">Retry</Caption>
        </Pressable>
      ) : null}
    </View>
  );
}
