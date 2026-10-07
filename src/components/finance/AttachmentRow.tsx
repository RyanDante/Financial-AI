import { Image, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, Caption } from '@/components/ui';
import { getUploadStatusLabel, isImageAttachment } from '@/features/attachments/attachments.mapper';
import { useThemeColors, type ColorKey } from '@/constants/theme';
import type { FileUpload } from '@/types/files';
import { useT } from '@/i18n';

const STATUS_COLOR: Record<FileUpload['status'], ColorKey> = {
  pending: 'text-muted',
  uploaded: 'success',
  failed: 'danger',
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
  const colors = useThemeColors();
  const { t } = useT();
  const statusColor = colors[STATUS_COLOR[attachment.status]];

  return (
    <View className="flex-row items-center gap-md py-sm">
      {isImageAttachment(attachment.mimeType) ? (
        <Image source={{ uri: attachment.localUri }} className="h-10 w-10 rounded-sm" />
      ) : (
        <View className="h-10 w-10 items-center justify-center rounded-sm bg-surface-elevated">
          <Ionicons name="document-text-outline" size={20} color={colors['text-secondary']} />
        </View>
      )}

      <View className="flex-1">
        <Body numberOfLines={1}>{attachment.filename}</Body>
        <View className="flex-row items-center gap-xs">
          <Ionicons name={STATUS_ICON[attachment.status]} size={12} color={statusColor} />
          <Caption style={{ color: statusColor }}>{getUploadStatusLabel(attachment.status)}</Caption>
        </View>
      </View>

      {attachment.status === 'failed' && onRetry ? (
        <Pressable onPress={() => onRetry(attachment)}>
          <Caption className="text-accent-secondary">{t('attachment.retry')}</Caption>
        </Pressable>
      ) : null}
    </View>
  );
}
