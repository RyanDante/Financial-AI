export type FileUploadStatus = 'pending' | 'uploaded' | 'failed';

/**
 * Tracks a file (receipt, statement, profile image, …) picked locally
 * until it's confirmed uploaded to Firebase Storage — see
 * docs/FIREBASE.md "Offline file handling". A row exists the moment the
 * user picks a file, before any network call, so the attachment is never
 * lost if they're offline at the time.
 */
export interface FileUpload {
  id: string;
  ownerEntityType: string;
  ownerEntityId: string | null;
  localUri: string;
  storagePath: string | null;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  status: FileUploadStatus;
  error: string | null;
  createdAt: string;
  uploadedAt: string | null;
}
