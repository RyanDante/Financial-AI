import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * The motion system (ui.md §26).
 *
 * Durations are intentionally short — this is an instrument, not a title
 * sequence. Nothing here exceeds 450ms. Every animated component reads its
 * duration from here rather than hardcoding a number, so `useReducedMotion`
 * can collapse all of them in one place.
 */
export const motion = {
  duration: {
    /** Button press in — fast, so the press feels immediate. */
    pressIn: 90,
    /** Button press out — slower than in, which is what makes it feel physical. */
    pressOut: 140,
    cardPress: 120,
    /** Progress fills chasing a new value. */
    progress: 450,
    tab: 220,
    sheet: 260,
    aiResponse: 240,
    /** Ambient loops: the sync pulse and the AI "thinking" dot. */
    pulse: 700,
  },
} as const;

/**
 * True when the user has asked the OS to reduce motion. Components use this
 * to collapse durations to 0 and to stop ambient loops entirely (a looping
 * opacity animation is exactly the kind of thing that setting exists for).
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (isCurrent) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      isCurrent = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

/** Duration helper: returns 0 when the user has asked for reduced motion. */
export function useMotionDuration(preferred: number): number {
  return useReducedMotion() ? 0 : preferred;
}
