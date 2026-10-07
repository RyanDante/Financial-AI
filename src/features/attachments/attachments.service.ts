import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { fileUploadsRepository } from '@/database/repositories';
import { retryUpload } from '@/services/cloud/storage';
import { isOnline } from '@/services/connectivity';
import type { FileUpload } from '@/types/files';

export interface PickedFile {
  uri: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  /** Pixel size, for photos (used to downscale before AI reading). */
  width?: number;
  height?: number;
}

/** Returns null if the user cancels or denies the permission — the caller just does nothing in that case. */
export async function pickImageFromLibrary(): Promise<PickedFile | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    filename: asset.fileName ?? `receipt-${Date.now()}.jpg`,
    mimeType: asset.mimeType ?? 'image/jpeg',
    sizeBytes: asset.fileSize ?? null,
    width: asset.width,
    height: asset.height,
  };
}

export async function takePhoto(): Promise<PickedFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    filename: asset.fileName ?? `receipt-${Date.now()}.jpg`,
    mimeType: asset.mimeType ?? 'image/jpeg',
    sizeBytes: asset.fileSize ?? null,
    width: asset.width,
    height: asset.height,
  };
}

export async function pickDocument(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    filename: asset.name,
    mimeType: asset.mimeType ?? null,
    sizeBytes: asset.size ?? null,
  };
}

/**
 * Records the picked file locally (so it's never lost even if the device
 * is offline right now — see docs/FIREBASE.md "Offline file handling"),
 * then makes one best-effort upload attempt if currently online and
 * signed in. The attempt is fire-and-forget from the caller's point of
 * view: if it fails or there's no signed-in user, the attachment stays
 * local and the next sync pass (manual or on reconnect) picks it up —
 * nothing here blocks the UI on the network.
 */
export async function attachFileToEntity(
  ownerEntityType: string,
  ownerEntityId: string,
  file: PickedFile,
  uidIfSignedIn: string | null,
): Promise<FileUpload> {
  const upload = await fileUploadsRepository.createPendingUpload({
    ownerEntityType,
    ownerEntityId,
    localUri: file.uri,
    filename: file.filename,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
  });

  if (uidIfSignedIn && (await isOnline())) {
    retryUpload(uidIfSignedIn, upload.id).catch(() => {
      // Already recorded on the row by retryUpload itself; nothing further to do here.
    });
  }

  return upload;
}
