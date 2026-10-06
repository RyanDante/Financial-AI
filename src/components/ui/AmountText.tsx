import { StyleSheet, Text, type TextProps } from 'react-native';
import { formatMoney } from '@/utils/currency';
import { getCurrencyMeta, type CurrencyCode } from '@/constants/currencies';
import { cn } from '@/utils/cn';

/**
 * Size steps are in ui.md §4. `xl` is the hero, `md` the default card figure,
 * `xs` for a figure that has to sit inside a sentence. If a figure would
 * overflow at its target size, step down one level — never truncate or wrap.
 */
type AmountSize = 'xl' | 'lg' | 'md' | 'sm' | 'xs';

const SIZE_CLASSES: Record<AmountSize, string> = {
  xl: 'text-[40px] leading-[44px]',
  lg: 'text-[30px] leading-[34px]',
  md: 'text-[22px] leading-[26px]',
  sm: 'text-[16px] leading-[20px]',
  xs: 'text-[13px] leading-[16px]',
};

/**
 * Financial figures get tabular numerals so balances don't jitter in width as
 * digits change and columns align. Space Grotesk has no true tabular set, so
 * this falls back to proportional — harmless, and it pays off the moment a
 * real tabular font is dropped in.
 */
const TABULAR_NUMERALS = StyleSheet.create({
  figure: { fontVariant: ['tabular-nums'] },
});

interface AmountTextProps extends TextProps {
  valueMinor: number;
  currency: CurrencyCode;
  size?: AmountSize;
  /** Semantic state from the token set — never an arbitrary color (ui.md §30). */
  /** `accentSecondary` is for transfers between your own accounts (ui.md §21). */
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'accent' | 'accentSecondary' | 'muted';
  /** Shows a "+" in front of positive amounts, next to an unsigned expense. */
  forceSign?: boolean;
  /**
   * Drops the currency symbol so it can be rendered as its own muted run via
   * `CurrencyMark`. Only the hero does this — everywhere else the symbol
   * travels with the number, because a bare figure is ambiguous.
   */
  showSymbol?: boolean;
  className?: string;
}

const TONE_CLASSES: Record<NonNullable<AmountTextProps['tone']>, string> = {
  primary: 'text-text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  accent: 'text-accent',
  accentSecondary: 'text-accent-secondary',
  muted: 'text-text-muted',
};

/**
 * The one place a monetary figure is rendered — always the display font,
 * always via formatMoney (never a raw number interpolated into a string), so
 * every balance/total in the app shares one numeric hierarchy.
 */
export function AmountText({
  valueMinor,
  currency,
  size = 'md',
  tone = 'primary',
  forceSign,
  showSymbol = true,
  className,
  style,
  ...props
}: AmountTextProps) {
  return (
    <Text
      style={[TABULAR_NUMERALS.figure, style]}
      className={cn('font-display', SIZE_CLASSES[size], TONE_CLASSES[tone], className)}
      {...props}
    >
      {formatMoney(valueMinor, currency, { forceSign, showSymbol })}
    </Text>
  );
}

/**
 * The currency symbol as its own visually subordinate run, for use beside an
 * `AmountText showSymbol={false}` in a hero. Prefer this over hiding the
 * symbol entirely — a unit the reader has to infer is a unit they can get
 * wrong.
 */
export function CurrencyMark({ currency, className, ...props }: TextProps & { currency: CurrencyCode }) {
  return (
    <Text className={cn('font-sans-bold text-[12px] uppercase tracking-widest text-text-muted', className)} {...props}>
      {getCurrencyMeta(currency).symbol}
    </Text>
  );
}
