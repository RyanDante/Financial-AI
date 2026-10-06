/* eslint-disable react-hooks/immutability -- Mutating `.value` is Reanimated's API for driving
   UI-thread animations; the rule mistakes shared values for React state (see Button.tsx). */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { BodySmall, Caption, IconCircle, Overline, Title } from '@/components/ui';
import { useThemeColors } from '@/constants/theme';
import { motion, useReducedMotion } from '@/constants/motion';
import type { Recommendation } from '@/features/recommendations/recommendations';

const AUTO_ADVANCE_MS = 6000;
const CARD_HEIGHT = 148;
const SWIPE_DISTANCE_RATIO = 0.2;
const SWIPE_VELOCITY = 500;
const SPRING = { damping: 20, stiffness: 220 };

interface RecommendationCarouselProps {
  items: Recommendation[];
  onAddExpense: (item: Recommendation) => void;
}

/**
 * Home's suggestions: one card at a time, swipe left for the next and right
 * for the previous, wrapping at both ends. It auto-advances every 6 s while
 * Home is on screen and you aren't touching it, and never when the OS asks
 * for reduced motion. Screen readers get it as one adjustable control.
 */
export function RecommendationCarousel({ items, onAddExpense }: RecommendationCarouselProps) {
  const colors = useThemeColors();
  const reducedMotion = useReducedMotion();
  const count = items.length;
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const isFocused = useRef(true);

  // The strip's x position is owned by the UI thread; `index` mirrors it for the dots, label and button.
  const offset = useSharedValue(0);
  const opacity = useSharedValue(1);
  const isDragging = useSharedValue(false);
  const activeIndex = useSharedValue(0);

  const safeIndex = count === 0 ? 0 : Math.min(index, count - 1);
  const item = items[safeIndex];

  useFocusEffect(
    useCallback(() => {
      isFocused.current = true;
      return () => {
        isFocused.current = false;
      };
    }, []),
  );

  const goTo = useCallback(
    (target: number, userInitiated: boolean) => {
      if (count === 0 || width === 0) return;
      const next = ((target % count) + count) % count;
      const from = activeIndex.value;
      const wraps = Math.abs(next - from) > 1;
      const duration = reducedMotion ? 0 : motion.duration.sheet;

      activeIndex.value = next;
      if (wraps) {
        // Jumping from the last card to the first (or back) would slide past every card: cross-fade instead.
        opacity.value = withSequence(withTiming(0, { duration: duration / 2 }), withTiming(1, { duration: duration / 2 }));
        offset.value = withSequence(withTiming(offset.value, { duration: duration / 2 }), withTiming(-next * width, { duration: 0 }));
      } else {
        offset.value = reducedMotion ? -next * width : withSpring(-next * width, SPRING);
      }
      setIndex(next);
      if (userInitiated) Haptics.selectionAsync();
    },
    [count, width, reducedMotion, activeIndex, offset, opacity],
  );

  // Keep the strip aligned when the width or the number of cards changes.
  useEffect(() => {
    if (count === 0) return;
    const clamped = Math.min(activeIndex.value, count - 1);
    activeIndex.value = clamped;
    offset.value = -clamped * width; // `safeIndex` already clamps the rendered index
  }, [width, count, activeIndex, offset]);

  // Auto-advance; the timer restarts after every change, so a swipe always gets a full 6 s.
  useEffect(() => {
    if (reducedMotion || count < 2 || width === 0) return;
    const timer = setTimeout(() => {
      if (isFocused.current && !isDragging.value) goTo(safeIndex + 1, false);
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [safeIndex, count, width, reducedMotion, goTo, isDragging]);

  const pan = Gesture.Pan()
    .enabled(count > 1)
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onBegin(() => {
      isDragging.value = true;
    })
    .onUpdate((e) => {
      offset.value = -activeIndex.value * width + e.translationX;
    })
    .onEnd((e) => {
      const threshold = width * SWIPE_DISTANCE_RATIO;
      if (e.translationX < -threshold || e.velocityX < -SWIPE_VELOCITY) {
        scheduleOnRN(goTo, activeIndex.value + 1, true); // swipe left: next
      } else if (e.translationX > threshold || e.velocityX > SWIPE_VELOCITY) {
        scheduleOnRN(goTo, activeIndex.value - 1, true); // swipe right: previous
      } else {
        offset.value = withSpring(-activeIndex.value * width, SPRING);
      }
    })
    .onFinalize(() => {
      isDragging.value = false;
    });

  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }], opacity: opacity.value }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (!item) return null;

  return (
    <View className="gap-sm">
      <GestureDetector gesture={pan}>
        <View
          onLayout={onLayout}
          className="overflow-hidden"
          style={{ height: CARD_HEIGHT }}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Suggestions"
          accessibilityValue={{ text: `${safeIndex + 1} of ${count}. ${item.reason}: ${item.title}. ${item.detail}` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => goTo(safeIndex + (e.nativeEvent.actionName === 'increment' ? 1 : -1), true)}
        >
          <Animated.View className="flex-row" style={[{ width: width * count, height: CARD_HEIGHT }, stripStyle]}>
            {items.map((card) => (
              <View key={card.id} style={{ width, height: CARD_HEIGHT }}>
                <SuggestionCard card={card} />
              </View>
            ))}
          </Animated.View>
        </View>
      </GestureDetector>

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-xs" importantForAccessibility="no-hide-descendants">
          {items.map((card, i) => (
            <View
              key={card.id}
              className="h-1.5 rounded-pill"
              style={{ width: i === safeIndex ? 16 : 6, backgroundColor: i === safeIndex ? colors.accent : colors['border-strong'] }}
            />
          ))}
        </View>
        <Pressable
          onPress={() => onAddExpense(item)}
          accessibilityRole="button"
          accessibilityLabel={`Add ${item.title} as an expense`}
          hitSlop={8}
          className="min-h-[44px] flex-row items-center gap-xs"
        >
          <Ionicons name="add-circle-outline" size={16} color={colors['accent-secondary']} />
          <Caption className="font-sans-semibold text-accent-secondary">Add as expense</Caption>
        </Pressable>
      </View>
    </View>
  );
}

function SuggestionCard({ card }: { card: Recommendation }) {
  const colors = useThemeColors();
  const tint = card.kind === 'bill' ? colors.warning : card.kind === 'repeat' ? colors['accent-secondary'] : colors.accent;
  return (
    <View className="flex-1 gap-sm rounded-lg border border-border bg-surface p-lg">
      <View className="flex-row items-center gap-md">
        <IconCircle name={card.icon} size={32} color={tint} backgroundColor={`${tint}26`} />
        <Overline className="flex-1">{card.reason}</Overline>
      </View>
      <Title numberOfLines={1}>{card.title}</Title>
      <BodySmall numberOfLines={2}>{card.detail}</BodySmall>
    </View>
  );
}
