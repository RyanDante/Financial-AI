import { Pressable, ScrollView, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AmountText, Body, Button, Caption, Card, EmptyState, IconCircle, Label, Overline } from '@/components/ui';
import { useBills } from '@/features/bills/useBills';
import { FREQUENCY_LABELS, formatDue, toBillItems } from '@/features/bills/bills';
import { useSettingsStore } from '@/store/settingsStore';
import { useThemeColors } from '@/constants/theme';
import { useT } from '@/i18n';

/** Subscriptions and recurring bills: what they cost per month and what's due next. */
export default function BillsScreen() {
  const colors = useThemeColors();
  const { t, tn } = useT();
  const { subscriptions, recurringExpenses } = useBills();
  const currency = useSettingsStore((s) => s.defaultCurrency);
  const items = toBillItems(subscriptions, recurringExpenses);
  const monthlyTotalMinor = items.filter((i) => i.currency === currency).reduce((sum, i) => sum + i.monthlyEquivalentMinor, 0);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg pb-3xl">
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/bills/new')} accessibilityRole="button" accessibilityLabel={t('nav.addBill')} hitSlop={8} className="h-11 w-11 items-end justify-center">
              <Ionicons name="add" size={26} color={colors['text-primary']} />
            </Pressable>
          ),
        }}
      />

      {items.length === 0 ? (
        <Card className="gap-md">
          <EmptyState
            icon="calendar-outline"
            title={t('bills.none')}
            description={t('bills.noneHint')}
          />
          <Button label={t('nav.addBill')} onPress={() => router.push('/bills/new')} />
        </Card>
      ) : (
        <>
          <Card className="gap-xs">
            <Overline>{t('bills.perMonth')}</Overline>
            <AmountText valueMinor={monthlyTotalMinor} currency={currency} size="lg" />
            <Caption>
              {tn('bills.across', items.length)}
            </Caption>
          </Card>

          <View className="gap-sm">
            <Label>{t('bills.comingUp')}</Label>
            <Card>
              {items.map((item, index) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push({ pathname: '/bills/new', params: { source: item.source, id: item.sourceId } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${FREQUENCY_LABELS[item.frequency]}, ${formatDue(item)}`}
                  accessibilityHint={t('bills.rowHint')}
                  className={index > 0 ? 'flex-row items-center gap-md border-t border-border py-md' : 'flex-row items-center gap-md py-md'}
                >
                  <IconCircle
                    name={item.source === 'subscription' ? 'repeat-outline' : 'calendar-outline'}
                    size={32}
                    color={item.inDays !== null && item.inDays <= 3 ? colors.warning : undefined}
                    backgroundColor={item.inDays !== null && item.inDays <= 3 ? colors['warning-muted'] : undefined}
                  />
                  <View className="flex-1">
                    <Body numberOfLines={1}>{item.name}</Body>
                    <Caption className={item.inDays !== null && item.inDays <= 3 ? 'text-warning' : undefined}>
                      {FREQUENCY_LABELS[item.frequency]} · {formatDue(item)}
                    </Caption>
                  </View>
                  <AmountText valueMinor={item.amountMinor} currency={item.currency} size="sm" />
                </Pressable>
              ))}
            </Card>
            <Caption>{t('bills.tapHint')}</Caption>
          </View>
        </>
      )}
    </ScrollView>
  );
}
