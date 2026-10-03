import { View, type ViewProps } from 'react-native';
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
  return (
    <View
      className={cn('rounded-lg border border-border bg-surface', variant === 'flat' ? 'p-lg' : 'p-xl', className)}
      style={[
        variant === 'raised' && {
          shadowColor: '#000',
          shadowOffset: { width: 4, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 0,
          elevation: 6,
        },
        style,
      ]}
      {...props}
    />
  );
}
