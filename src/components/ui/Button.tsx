import { Pressable, type PressableProps } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Body } from './Typography';
import { cn } from '@/utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

const VARIANT_CLASSES: Record<ButtonVariant, { container: string; label: string }> = {
  primary: { container: 'bg-accent border-accent', label: 'text-text-primary' },
  secondary: { container: 'bg-surface border-border-strong', label: 'text-text-primary' },
  danger: { container: 'bg-danger-muted border-danger', label: 'text-danger' },
};

interface ButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: ButtonVariant;
  className?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Primary interactive control. Presses give a quick scale-down and a light haptic tap, per the design spec's "animation communicates state" rule. */
export function Button({ label, variant = 'primary', className, onPressIn, onPressOut, onPress, ...props }: ButtonProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const { container, label: labelClass } = VARIANT_CLASSES[variant];

  return (
    <AnimatedPressable
      style={animatedStyle}
      className={cn('items-center justify-center rounded-md border-2 px-lg py-md', container, className)}
      onPressIn={(e) => {
        // Mutating `.value` is the sanctioned Reanimated API for driving UI-thread
        // animations without a re-render; the react-hooks immutability rule doesn't
        // know about shared values and flags this as if it were React state.
        // eslint-disable-next-line react-hooks/immutability
        scale.value = withTiming(0.97, { duration: 80 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        // eslint-disable-next-line react-hooks/immutability
        scale.value = withTiming(1, { duration: 120 });
        onPressOut?.(e);
      }}
      onPress={(e) => {
        Haptics.selectionAsync();
        onPress?.(e);
      }}
      {...props}
    >
      <Body className={cn('font-sans-semibold', labelClass)}>{label}</Body>
    </AnimatedPressable>
  );
}
