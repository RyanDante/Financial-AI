/* eslint-disable @typescript-eslint/no-require-imports -- loaded lazily on purpose (see below) */
import Constants, { ExecutionEnvironment } from 'expo-constants';

type SharingModule = typeof import('expo-sharing');

let cached: SharingModule | null | undefined;

/**
 * expo-sharing's receive side, or null in Expo Go, which can't be a
 * share target (that needs the share extension / intent filters of a
 * development build).
 */
export function getSharing(): SharingModule | null {
  if (cached !== undefined) return cached;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    cached = null;
    return cached;
  }
  try {
    const mod = require('expo-sharing') as SharingModule;
    cached = typeof mod.useIncomingShare === 'function' ? mod : null;
  } catch {
    cached = null;
  }
  return cached;
}
