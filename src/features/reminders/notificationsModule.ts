import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null | undefined;

/**
 * True in Expo Go on Android, where expo-notifications throws as soon as
 * it's imported (SDK 53+ removed it from Expo Go there). Reminders need a
 * development build on Android; everything else works in Expo Go.
 */
export const remindersUnsupportedHere = Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * expo-notifications, loaded lazily and only where it can load. Never
 * import it statically anywhere in the app: a top-level import crashes
 * the whole app in Expo Go on Android before any screen renders.
 */
export function getNotifications(): NotificationsModule | null {
  if (cached !== undefined) return cached;
  if (remindersUnsupportedHere) {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule;
  } catch {
    cached = null;
  }
  return cached;
}
