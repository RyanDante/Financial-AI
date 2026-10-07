/* eslint-disable @typescript-eslint/no-require-imports -- the keyboard library is loaded lazily on purpose (see below) */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView as RNKeyboardAvoidingView, ScrollView, type KeyboardAvoidingViewProps, type ScrollViewProps } from 'react-native';
import { cssInterop } from 'nativewind';

type KeyboardControllerModule = typeof import('react-native-keyboard-controller');

let cached: KeyboardControllerModule | null | undefined;

/**
 * react-native-keyboard-controller, or null where its native side can't
 * load. Expo Go (SDK 57) and development builds include it; the fallback
 * keeps every form usable with React Native's own KeyboardAvoidingView.
 */
function getKeyboardController(): KeyboardControllerModule | null {
  if (cached !== undefined) return cached;
  try {
    const mod = require('react-native-keyboard-controller') as KeyboardControllerModule;
    // NativeWind only maps className on React Native's own components.
    cssInterop(mod.KeyboardAwareScrollView, { className: 'style', contentContainerClassName: 'contentContainerStyle' });
    cssInterop(mod.KeyboardAvoidingView, { className: 'style' });
    cached = mod;
  } catch (error) {
    if (__DEV__) console.warn('[keyboard] react-native-keyboard-controller unavailable, using the React Native fallback', error);
    cached = null;
  }
  return cached;
}

/** Wraps the app once, at the root, so keyboard-aware views can follow the keyboard frame by frame. */
export function KeyboardRoot({ children }: { children: ReactNode }) {
  const KC = getKeyboardController();
  if (!KC) return <>{children}</>;
  return <KC.KeyboardProvider>{children}</KC.KeyboardProvider>;
}

/**
 * A form's ScrollView that keeps the focused field above the keyboard,
 * scrolling it into view when the keyboard opens or focus moves.
 */
export function FormScrollView({ children, ...props }: ScrollViewProps & { className?: string; contentContainerClassName?: string }) {
  const KC = getKeyboardController();
  if (KC) {
    return (
      <KC.KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" {...props}>
        {children}
      </KC.KeyboardAwareScrollView>
    );
  }
  return (
    <RNKeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" {...props}>
        {children}
      </ScrollView>
    </RNKeyboardAvoidingView>
  );
}

/**
 * Shrinks its content by the part of the keyboard that overlaps it, so a
 * bottom-pinned composer stays visible. Pass the height of anything above
 * it (e.g. the AppBar) as `keyboardVerticalOffset`; space below it, like
 * the tab bar, is accounted for automatically.
 */
export function KeyboardAvoider({ children, ...props }: Omit<KeyboardAvoidingViewProps, 'behavior'> & { className?: string }) {
  const KC = getKeyboardController();
  const Avoider = KC ? KC.KeyboardAvoidingView : RNKeyboardAvoidingView;
  return (
    <Avoider behavior="padding" {...props}>
      {children}
    </Avoider>
  );
}
