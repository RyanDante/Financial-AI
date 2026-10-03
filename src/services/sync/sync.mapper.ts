import { Timestamp } from 'firebase/firestore';
import type { SyncEntityConfig } from './sync.types';

/**
 * The one place ISO-string (local SQLite) <-> Firestore Timestamp (cloud)
 * conversion happens. Local storage and the financial engine only ever see
 * ISO-8601 strings (see src/utils/currency.ts and every repository) —
 * nothing outside this file should construct or read a Firestore Timestamp
 * directly, so the rest of the app never has to care which representation
 * it's looking at.
 */
export function isoToTimestamp(iso: string): Timestamp {
  return Timestamp.fromDate(new Date(iso));
}

export function timestampToIso(value: Timestamp | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.toDate().toISOString();
}

const TIMESTAMP_FIELDS = ['created_at', 'updated_at', 'deleted_at'] as const;

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

/**
 * Converts a raw SQLite row (snake_case keys, ISO-string timestamps) into a
 * Firestore-ready document (camelCase keys, Timestamp values) for exactly
 * the columns an entity config declares — any other key on the row is
 * ignored, so a stray local column never leaks into the cloud doc.
 */
export function localRowToCloudDoc(row: Record<string, unknown>, entity: SyncEntityConfig): Record<string, unknown> {
  const doc: Record<string, unknown> = { id: row.id };

  for (const column of entity.columns) {
    doc[snakeToCamel(column)] = row[column] ?? null;
  }

  for (const field of TIMESTAMP_FIELDS) {
    if (field === 'deleted_at' && !entity.supportsSoftDelete) continue;
    if (!(field in row)) continue;
    const value = row[field] as string | null;
    doc[snakeToCamel(field)] = value ? isoToTimestamp(value) : null;
  }

  return doc;
}

/**
 * Inverse of localRowToCloudDoc — converts a Firestore document back into a
 * snake_case row object ready to bind into a parameterized SQL statement.
 */
export function cloudDocToLocalRow(doc: Record<string, unknown>, entity: SyncEntityConfig): Record<string, unknown> {
  const row: Record<string, unknown> = { id: doc.id };

  for (const column of entity.columns) {
    row[column] = doc[snakeToCamel(column)] ?? null;
  }

  for (const field of TIMESTAMP_FIELDS) {
    if (field === 'deleted_at' && !entity.supportsSoftDelete) continue;
    const camelField = snakeToCamel(field);
    if (!(camelField in doc)) continue;
    row[field] = timestampToIso(doc[camelField] as Timestamp | null);
  }

  return row;
}

export { snakeToCamel, camelToSnake };
