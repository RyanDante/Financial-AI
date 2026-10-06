import { View, type ViewProps } from 'react-native';
import { useShadow } from '@/constants/shadows';
import { cn } from '@/utils/cn';

interface CardProps extends ViewProps {
  className?: string;
  /** "raised" adds a hard offset shadow for emphasis (e.g. the balance hero card). "flat" is for list rows. */
  variant?: 'raised' | 'flat';
}

/**
 * The base neo-brutalist surface: a bordered, square-cornered-ish panel
 * with a hard (not soft/blurred) shadow. Every card-like surface in the
 * app should be built from this rather than ad-hoc View + style combos, so
 * the border weight and shadow stay consistent everywhere.
 */
export function Card({ className, variant = 'flat', style, ...props }: CardProps) {
  // The theme's hard slab shadow: a violet extrusion in dark mode (a black
  // one vanishes on the near-black canvas), ink in light mode (ui.md §7).
  const raisedShadow = useShadow('brutal-lg');

  return (
    <View
      className={cn('rounded-lg border border-border bg-surface', variant === 'flat' ? 'p-lg' : 'p-xl', className)}
      style={[variant === 'raised' && raisedShadow, style]}
      {...props}
    />
  );
}
