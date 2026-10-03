import { ref, uploadBytes } from 'firebase/storage';
// Importing the specific submodule (not the @/services/firebase barrel)
// matters here: the barrel re-exports auth.ts, which pulls in AsyncStorage's
// native module — fine at runtime, but it has no native bridge under Jest,
// so a test importing this file would fail even though it never touches auth.
import { getFirebaseStorage } from '@/services/firebase/storage';
import { userStoragePath } from './firestore/paths';
import { getStorageKindForEntityType } from './storageKind';
import { fileUploadsRepository } from '@/database/repositories';
import type { FileUpload } from '@/types/files';

async function uploadOne(uid: string, upload: FileUpload): Promise<void> {
  const storagePath = userStoragePath(uid, getStorageKindForEntityType(upload.ownerEntityType), upload.id);

  const response = await fetch(upload.localUri);
  const blob = await response.blob();

  await uploadBytes(ref(getFirebaseStorage(), storagePath), blob, {
    contentType: upload.mimeType ?? undefined,
  });

  await fileUploadsRepository.markUploadComplete(upload.id, storagePath);
}

/**
 * Uploads every pending AND previously-failed local file to Firebase
 * Storage. Retrying failed uploads here (not just on a manual tap) means a
 * transient failure heals itself on the next sync/reconnect pass, the same
 * way a failed Firestore push does — see docs/FIREBASE.md "Offline file
 * handling". Picking a file never blocks on this running.
 */
export async function processPendingUploads(uid: string): Promise<{ uploaded: number; failed: number }> {
  const toProcess = await fileUploadsRepository.listUploadsToRetry();
  let uploaded = 0;
  let failed = 0;

  for (const upload of toProcess) {
    try {
      await uploadOne(uid, upload);
      uploaded += 1;
    } catch (error) {
      failed += 1;
      await fileUploadsRepository.markUploadFailed(upload.id, error instanceof Error ? error.message : String(error));
    }
  }

  return { uploaded, failed };
}

/** Re-attempts a single failed (or pending) upload — the "Retry" button in the attachments UI. Updates the row's status either way, so the caller just needs to re-read it. */
export async function retryUpload(uid: string, uploadId: string): Promise<void> {
  const upload = await fileUploadsRepository.getFileUploadById(uploadId);
  if (!upload) throw new Error(`Upload ${uploadId} not found`);
  if (upload.status === 'uploaded') return;

  try {
    await uploadOne(uid, upload);
  } catch (error) {
    await fileUploadsRepository.markUploadFailed(uploadId, error instanceof Error ? error.message : String(error));
  }
}
