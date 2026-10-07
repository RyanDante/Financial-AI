import type { FileUploadStatus } from '@/types/files';
import { t } from '@/i18n';

export function getUploadStatusLabel(status: FileUploadStatus): string {
  switch (status) {
    case 'pending':
      return t('upload.pending');
    case 'uploaded':
      return t('upload.uploaded');
    case 'failed':
      return t('upload.failed');
  }
}

export function isImageAttachment(mimeType: string | null): boolean {
  return mimeType?.startsWith('image/') ?? false;
}
