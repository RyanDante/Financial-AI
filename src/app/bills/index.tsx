import { Alert, Pressable, ScrollView, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AmountText, Body, Button, Caption, Card, EmptyState, IconCircle, Label, Overline } from '@/components/ui';
import { recurringExpensesRepository, subscriptionsRepository } from '@/database/repositories';
import { useBills } from '@/features/bills/useBills';
import { FREQUENCY_LABELS, formatDue, toBillItems, type BillItem } from '@/features/bills/bills';
import { useFinanceStore } from '@/store/financeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useThemeColors } from '@/constants/theme';

/** Subscriptions and recurring bills: what they cost per month and what's due next. */
export default function BillsScreen() {
  const colors = useThemeColors();
  const { subscriptions, recurringExpenses } = useBills();
  const loadAll = useFinanceStore((s) => s.loadAll);
  const currency = useSettingsStore((s) => s.defaultCurrency);
  const items = toBillItems(subscriptions, recurringExpenses);
  const monthlyTotalMinor = items.filter((i) => i.currency === currency).reduce((sum, i) => sum + i.monthlyEquivalentMinor, 0);

  const stopTracking = (item: BillItem) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(`Stop tracking ${item.name}?`, 'It will no longer count toward your upcoming bills or safe-to-spend amount.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop tracking',
        style: 'destructive',
        onPress: async () => {
          if (item.source === 'subscription') await subscriptionsRepository.setSubscriptionActive(item.sourceId, false);
          else await recurringExpensesRepository.setRecurringExpenseActive(item.sourceId, false);
          await loadAll();
        },
      },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg pb-3xl">
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/bills/new')} accessibilityRole="button" accessibilityLabel="Add a bill" hitSlop={8} className="h-11 w-11 items-end justify-center">
              <Ionicons name="add" size={26} color={colors['text-primary']} />
            </Pressable>
          ),
        }}
      />

      {items.length === 0 ? (
        <Card className="gap-md">
          <EmptyState
            icon="calendar-outline"
            title="No bills or subscriptions yet"
            description="Add rent, electricity, TV or phone plans so F-AI can set money aside for them."
          />
          <Button label="Add a bill" onPress={() => router.push('/bills/new')} />
        </Card>
      ) : (
        <>
          <Card className="gap-xs">
            <Overline>Per month</Overline>
            <AmountText valueMinor={monthlyTotalMinor} currency={currency} size="lg" />
            <Caption>
              Across {items.length} {items.length === 1 ? 'bill' : 'bills'}. Yearly and weekly bills are shown as their monthly share.
            </Caption>
          </Card>

          <View className="gap-sm">
            <Label>Coming up</Label>
            <Card>
              {items.map((item, index) => (
                <Pressable
                  key={item.id}
                  onPress={() => stopTracking(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${FREQUENCY_LABELS[item.frequency]}, ${formatDue(item)}`}
                  accessibilityHint="Stop tracking this bill"
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
            <Caption>Tap a bill to stop tracking it.</Caption>
          </View>
        </>
      )}
    </ScrollView>
  );
}
