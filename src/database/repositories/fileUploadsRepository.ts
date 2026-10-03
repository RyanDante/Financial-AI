import * as Crypto from 'expo-crypto';
import { getDatabase } from '../client';
import type { FileUpload, FileUploadStatus } from '@/types/files';

interface FileUploadRow {
  id: string;
  owner_entity_type: string;
  owner_entity_id: string | null;
  local_uri: string;
  storage_path: string | null;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  status: FileUploadStatus;
  error: string | null;
  created_at: string;
  uploaded_at: string | null;
}

function mapRow(row: FileUploadRow): FileUpload {
  return {
    id: row.id,
    ownerEntityType: row.owner_entity_type,
    ownerEntityId: row.owner_entity_id,
    localUri: row.local_uri,
    storagePath: row.storage_path,
    filename: row.filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    status: row.status,
    error: row.error,
    createdAt: row.created_at,
    uploadedAt: row.uploaded_at,
  };
}

export interface CreatePendingUploadInput {
  ownerEntityType: string;
  ownerEntityId?: string | null;
  localUri: string;
  filename: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
}

/** Records a file as picked, before any upload attempt — see docs/FIREBASE.md "Offline file handling". */
export async function createPendingUpload(input: CreatePendingUploadInput): Promise<FileUpload> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO file_uploads (id, owner_entity_type, owner_entity_id, local_uri, filename, mime_type, size_bytes, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    id,
    input.ownerEntityType,
    input.ownerEntityId ?? null,
    input.localUri,
    input.filename,
    input.mimeType ?? null,
    input.sizeBytes ?? null,
    now,
  );
  return {
    id,
    ownerEntityType: input.ownerEntityType,
    ownerEntityId: input.ownerEntityId ?? null,
    localUri: input.localUri,
    storagePath: null,
    filename: input.filename,
    mimeType: input.mimeType ?? null,
    sizeBytes: input.sizeBytes ?? null,
    status: 'pending',
    error: null,
    createdAt: now,
    uploadedAt: null,
  };
}

export async function listPendingUploads(): Promise<FileUpload[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<FileUploadRow>("SELECT * FROM file_uploads WHERE status = 'pending' ORDER BY created_at ASC");
  return rows.map(mapRow);
}

/** Pending AND previously-failed uploads — what a sync pass should attempt, so a failed upload isn't stuck forever without a manual retry tap. */
export async function listUploadsToRetry(): Promise<FileUpload[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<FileUploadRow>(
    "SELECT * FROM file_uploads WHERE status IN ('pending', 'failed') ORDER BY created_at ASC",
  );
  return rows.map(mapRow);
}

export async function getFileUploadById(id: string): Promise<FileUpload | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<FileUploadRow>('SELECT * FROM file_uploads WHERE id = ?', id);
  return row ? mapRow(row) : null;
}

export async function listUploadsForOwner(ownerEntityType: string, ownerEntityId: string): Promise<FileUpload[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<FileUploadRow>(
    'SELECT * FROM file_uploads WHERE owner_entity_type = ? AND owner_entity_id = ? ORDER BY created_at ASC',
    ownerEntityType,
    ownerEntityId,
  );
  return rows.map(mapRow);
}

export async function markUploadComplete(id: string, storagePath: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE file_uploads SET status = 'uploaded', storage_path = ?, uploaded_at = ?, error = NULL WHERE id = ?",
    storagePath,
    new Date().toISOString(),
    id,
  );
}

export async function markUploadFailed(id: string, error: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE file_uploads SET status = 'failed', error = ? WHERE id = ?", error, id);
}
