import type { NativeIntent } from 'expo-router';

/**
 * Something shared to F-AI from another app (an SMS, a screenshot) opens
 * the app with an `expo-sharing` link; send it to the share handler.
 * Everything else passes through unchanged. Must never throw.
 */
export const redirectSystemPath: NativeIntent['redirectSystemPath'] = ({ path }) => {
  try {
    if (new URL(path).hostname === 'expo-sharing') return '/share';
  } catch {
    // A plain route path, not a URL.
  }
  return path;
};
