import { Pressable, ScrollView, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AmountText, Body, Button, Caption, Card, EmptyState, IconCircle, Label, Overline, ProgressBar } from '@/components/ui';
import { useDebts, debtTotals } from '@/features/debts/useDebts';
import { nextDebtDueDate } from '@/features/allowance/allowance';
import { useSettingsStore } from '@/store/settingsStore';
import { useThemeColors } from '@/constants/theme';
import { formatMoney } from '@/utils/currency';
import type { Debt, DebtDirection } from '@/types/finance';
import { getLocale, useT, type MessageKey } from '@/i18n';

const SECTIONS: { direction: DebtDirection; title: MessageKey; empty: MessageKey }[] = [
  { direction: 'i_owe', title: 'debts.youOwe', empty: 'debts.youOweEmpty' },
  { direction: 'owed_to_me', title: 'debts.owedToYou', empty: 'debts.owedEmpty' },
];

/** Money the user owes and money owed to them, with what's left and when the next payment is due. */
export default function DebtsScreen() {
  const colors = useThemeColors();
  const { t } = useT();
  const debts = useDebts();
  const currency = useSettingsStore((s) => s.defaultCurrency);
  const { iOweMinor, owedToMeMinor } = debtTotals(debts, currency);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg pb-3xl">
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/debts/new')} accessibilityRole="button" accessibilityLabel={t('nav.addDebt')} hitSlop={8} className="h-11 w-11 items-end justify-center">
              <Ionicons name="add" size={26} color={colors['text-primary']} />
            </Pressable>
          ),
        }}
      />

      {debts.length === 0 ? (
        <Card className="gap-md">
          <EmptyState icon="people-outline" title={t('debts.none')} description={t('debts.noneHint')} />
          <Button label={t('nav.addDebt')} onPress={() => router.push('/debts/new')} />
        </Card>
      ) : (
        <>
          <Card className="flex-row gap-lg">
            <View className="flex-1 gap-xs">
              <Overline>{t('debts.youOwe')}</Overline>
              <AmountText valueMinor={iOweMinor} currency={currency} size="md" tone={iOweMinor > 0 ? 'danger' : 'primary'} />
            </View>
            <View className="flex-1 gap-xs">
              <Overline>{t('debts.owedToYou')}</Overline>
              <AmountText valueMinor={owedToMeMinor} currency={currency} size="md" tone={owedToMeMinor > 0 ? 'success' : 'primary'} />
            </View>
          </Card>

          {SECTIONS.map((section) => {
            const rows = debts.filter((d) => d.direction === section.direction);
            return (
              <View key={section.direction} className="gap-sm">
                <Label>{t(section.title)}</Label>
                <Card>
                  {rows.length === 0 ? <Caption>{t(section.empty)}</Caption> : rows.map((debt, i) => <DebtRow key={debt.id} debt={debt} first={i === 0} />)}
                </Card>
              </View>
            );
          })}
          <Caption>{t('debts.tapHint')}</Caption>
        </>
      )}
    </ScrollView>
  );
}

function DebtRow({ debt, first }: { debt: Debt; first: boolean }) {
  const colors = useThemeColors();
  const { t } = useT();
  const settled = debt.remainingMinor <= 0;
  const paidPercent = debt.principalMinor > 0 ? ((debt.principalMinor - debt.remainingMinor) / debt.principalMinor) * 100 : 0;
  const due = settled ? null : nextDebtDueDate(debt);
  const isOwed = debt.direction === 'owed_to_me';
  const tint = settled ? colors.success : isOwed ? colors['accent-secondary'] : colors.warning;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/debts/pay', params: { id: debt.id } })}
      accessibilityRole="button"
      accessibilityLabel={t('debts.rowA11y', { name: debt.counterparty ? `${debt.name}, ${debt.counterparty}` : debt.name, amount: formatMoney(debt.remainingMinor, debt.currency) })}
      className={first ? 'gap-sm py-md' : 'gap-sm border-t border-border py-md'}
    >
      <View className="flex-row items-center gap-md">
        <IconCircle name={settled ? 'checkmark' : isOwed ? 'arrow-down' : 'arrow-up'} size={32} color={tint} backgroundColor={`${tint}26`} />
        <View className="flex-1">
          <Body numberOfLines={1}>{debt.counterparty ? `${debt.counterparty} · ${debt.name}` : debt.name}</Body>
          <Caption>
            {settled
              ? t('debts.settled')
              : t('debts.paidOf', { paid: formatMoney(debt.principalMinor - debt.remainingMinor, debt.currency), total: formatMoney(debt.principalMinor, debt.currency) }) +
                (due ? t('debts.dueOn', { date: due.toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' }) }) : '')}
          </Caption>
        </View>
        <AmountText valueMinor={debt.remainingMinor} currency={debt.currency} size="sm" tone={settled ? 'success' : 'primary'} />
      </View>
      <ProgressBar percent={paidPercent} tone={settled ? 'success' : 'accent'} />
    </Pressable>
  );
}
