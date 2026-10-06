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

const SECTIONS: { direction: DebtDirection; title: string; empty: string }[] = [
  { direction: 'i_owe', title: 'You owe', empty: 'Nothing you owe is tracked.' },
  { direction: 'owed_to_me', title: 'Owed to you', empty: 'Nobody owes you money right now.' },
];

/** Money the user owes and money owed to them, with what's left and when the next payment is due. */
export default function DebtsScreen() {
  const colors = useThemeColors();
  const debts = useDebts();
  const currency = useSettingsStore((s) => s.defaultCurrency);
  const { iOweMinor, owedToMeMinor } = debtTotals(debts, currency);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg pb-3xl">
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/debts/new')} accessibilityRole="button" accessibilityLabel="Add a debt" hitSlop={8} className="h-11 w-11 items-end justify-center">
              <Ionicons name="add" size={26} color={colors['text-primary']} />
            </Pressable>
          ),
        }}
      />

      {debts.length === 0 ? (
        <Card className="gap-md">
          <EmptyState icon="people-outline" title="No debts tracked" description="Add a loan you're repaying, or money you lent to family or friends." />
          <Button label="Add a debt" onPress={() => router.push('/debts/new')} />
        </Card>
      ) : (
        <>
          <Card className="flex-row gap-lg">
            <View className="flex-1 gap-xs">
              <Overline>You owe</Overline>
              <AmountText valueMinor={iOweMinor} currency={currency} size="md" tone={iOweMinor > 0 ? 'danger' : 'primary'} />
            </View>
            <View className="flex-1 gap-xs">
              <Overline>Owed to you</Overline>
              <AmountText valueMinor={owedToMeMinor} currency={currency} size="md" tone={owedToMeMinor > 0 ? 'success' : 'primary'} />
            </View>
          </Card>

          {SECTIONS.map((section) => {
            const rows = debts.filter((d) => d.direction === section.direction);
            return (
              <View key={section.direction} className="gap-sm">
                <Label>{section.title}</Label>
                <Card>
                  {rows.length === 0 ? <Caption>{section.empty}</Caption> : rows.map((debt, i) => <DebtRow key={debt.id} debt={debt} first={i === 0} />)}
                </Card>
              </View>
            );
          })}
          <Caption>Tap a debt to record a payment.</Caption>
        </>
      )}
    </ScrollView>
  );
}

function DebtRow({ debt, first }: { debt: Debt; first: boolean }) {
  const colors = useThemeColors();
  const settled = debt.remainingMinor <= 0;
  const paidPercent = debt.principalMinor > 0 ? ((debt.principalMinor - debt.remainingMinor) / debt.principalMinor) * 100 : 0;
  const due = settled ? null : nextDebtDueDate(debt);
  const isOwed = debt.direction === 'owed_to_me';
  const tint = settled ? colors.success : isOwed ? colors['accent-secondary'] : colors.warning;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/debts/pay', params: { id: debt.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${debt.name}${debt.counterparty ? `, ${debt.counterparty}` : ''}: ${formatMoney(debt.remainingMinor, debt.currency)} left. Record a payment`}
      className={first ? 'gap-sm py-md' : 'gap-sm border-t border-border py-md'}
    >
      <View className="flex-row items-center gap-md">
        <IconCircle name={settled ? 'checkmark' : isOwed ? 'arrow-down' : 'arrow-up'} size={32} color={tint} backgroundColor={`${tint}26`} />
        <View className="flex-1">
          <Body numberOfLines={1}>{debt.counterparty ? `${debt.counterparty} · ${debt.name}` : debt.name}</Body>
          <Caption>
            {settled
              ? 'Settled'
              : `${formatMoney(debt.principalMinor - debt.remainingMinor, debt.currency)} of ${formatMoney(debt.principalMinor, debt.currency)} paid${
                  due ? ` · due ${due.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''
                }`}
          </Caption>
        </View>
        <AmountText valueMinor={debt.remainingMinor} currency={debt.currency} size="sm" tone={settled ? 'success' : 'primary'} />
      </View>
      <ProgressBar percent={paidPercent} tone={settled ? 'success' : 'accent'} />
    </Pressable>
  );
}
