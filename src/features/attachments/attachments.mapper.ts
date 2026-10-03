import type { FileUploadStatus } from '@/types/files';

export function getUploadStatusLabel(status: FileUploadStatus): string {
  switch (status) {
    case 'pending':
      return 'Waiting to upload';
    case 'uploaded':
      return 'Backed up';
    case 'failed':
      return 'Upload failed';
  }
}

export function isImageAttachment(mimeType: string | null): boolean {
  return mimeType?.startsWith('image/') ?? false;
}
