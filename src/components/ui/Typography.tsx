import { Text, type TextProps } from 'react-native';
import { cn } from '@/utils/cn';

/**
 * The type system (ui.md §4).
 *
 * Two families, split by job and never mixed within a component:
 *   - Space Grotesk (`font-display`) — financial figures ONLY, via AmountText.
 *   - Inter (`font-sans*`) — everything here.
 *
 * Prefer these components over raw `text-[Npx]` classNames; the sizes below
 * are the documented scale, and an ad-hoc size is a token that doesn't exist.
 */
interface TypographyProps extends TextProps {
  className?: string;
}

/** The single largest figure on a screen. Space Grotesk — one per screen, on the hero. */
export function Display({ className, ...props }: TypographyProps) {
  return <Text className={cn('font-display text-[44px] leading-[46px] text-text-primary', className)} {...props} />;
}

/** Screen and modal titles. */
export function Heading({ className, ...props }: TypographyProps) {
  return <Text className={cn('font-sans-bold text-[22px] leading-[28px] text-text-primary', className)} {...props} />;
}

/** Card titles and a list row's primary text. */
export function Title({ className, ...props }: TypographyProps) {
  return <Text className={cn('font-sans-semibold text-[17px] leading-[22px] text-text-primary', className)} {...props} />;
}

/** Default body copy, including AI narration. */
export function Body({ className, ...props }: TypographyProps) {
  return <Text className={cn('font-sans text-[15px] leading-[21px] text-text-primary', className)} {...props} />;
}

/** Secondary copy and dense lists. Never below 13px — body copy has a floor. */
export function BodySmall({ className, ...props }: TypographyProps) {
  return <Text className={cn('font-sans text-[13px] leading-[18px] text-text-secondary', className)} {...props} />;
}

/** Field labels and inline labels. */
export function Label({ className, ...props }: TypographyProps) {
  return <Text className={cn('font-sans-medium text-[13px] leading-[16px] text-text-secondary', className)} {...props} />;
}

/**
 * The financial label. Uppercase, wide-tracked, bold — this is what turns
 * "Total spending" into something that reads as instrumentation. Use it for
 * anything describing a figure; sentence case in a label reads as unpolished
 * (ui.md §4).
 */
export function Overline({ className, ...props }: TypographyProps) {
  return <Text className={cn('font-sans-bold text-[10px] leading-[12px] uppercase tracking-widest text-text-muted', className)} {...props} />;
}

/** Timestamps, metadata, units. Never load-bearing. */
export function Caption({ className, ...props }: TypographyProps) {
  return <Text className={cn('font-sans text-[11px] leading-[14px] text-text-muted', className)} {...props} />;
}
