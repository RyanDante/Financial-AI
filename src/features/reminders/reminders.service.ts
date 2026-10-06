import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { budgetsRepository, categoriesRepository, debtsRepository, recurringExpensesRepository, settingsRepository, subscriptionsRepository, transactionsRepository } from '@/database/repositories';
import { calculateMonthlySpending } from '@/finance/calculations';
import { toBillItems } from '@/features/bills/bills';
import { currentMonthKey, isInMonth, monthRange } from '@/utils/months';
import { budgetWarnings, planReminders, type BudgetUsage } from './reminders';

const REMINDERS_KEY = 'reminders_enabled';
const SENT_BUDGET_WARNINGS_KEY = 'budget_warnings_sent';
const CHANNEL_ID = 'reminders';

/** Show reminders as banners even while F-AI is open. Call once at startup. */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL_ID, { name: 'Bill and budget reminders', importance: Notifications.AndroidImportance.DEFAULT }).catch(() => {});
  }
}

export async function remindersEnabled(): Promise<boolean> {
  return (await settingsRepository.getSetting(REMINDERS_KEY)) === 'true';
}

/** Asks for notification permission and turns reminders on. Returns a message when it can't. */
export async function enableReminders(): Promise<string | null> {
  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return 'Notifications are off for F-AI. Allow them in your phone settings to get reminders.';
  await settingsRepository.setSetting(REMINDERS_KEY, 'true');
  await syncReminders();
  return null;
}

export async function disableReminders(): Promise<void> {
  await settingsRepository.setSetting(REMINDERS_KEY, 'false');
  await Notifications.cancelAllScheduledNotificationsAsync();
}

let syncing: Promise<void> | null = null;

/**
 * Rebuilds every scheduled reminder from current data (bills, debts) and
 * sends any new budget warning. Safe to call after any change: it cancels
 * and reschedules, and overlapping calls share one run.
 */
export function syncReminders(): Promise<void> {
  syncing ??= runSync().finally(() => {
    syncing = null;
  });
  return syncing;
}

async function runSync(): Promise<void> {
  try {
    if (!(await remindersEnabled())) return;
    if (!(await Notifications.getPermissionsAsync()).granted) return;

    const [subscriptions, recurringExpenses, debts] = await Promise.all([
      subscriptionsRepository.listSubscriptions(true),
      recurringExpensesRepository.listRecurringExpenses(true),
      debtsRepository.listDebts(),
    ]);
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const reminder of planReminders(toBillItems(subscriptions, recurringExpenses), debts)) {
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.id,
        content: { title: reminder.title, body: reminder.body, data: { url: reminder.id.startsWith('debt') ? '/debts' : '/bills' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.date, channelId: CHANNEL_ID },
      });
    }

    await sendBudgetWarnings();
  } catch (error) {
    // Reminders are best-effort; a failure must never break the app.
    if (__DEV__) console.warn('[reminders] sync failed', error);
  }
}

async function sendBudgetWarnings(): Promise<void> {
  const month = currentMonthKey();
  const budget = await budgetsRepository.getBudgetForMonth(month);
  if (!budget) return;
  const { from, to } = monthRange(month);
  const [limits, categories, transactions, sentRaw] = await Promise.all([
    budgetsRepository.listBudgetCategories(budget.id),
    categoriesRepository.listCategories(),
    transactionsRepository.listTransactions({ from, to, type: 'expense' }),
    settingsRepository.getSetting(SENT_BUDGET_WARNINGS_KEY),
  ]);
  const monthTransactions = transactions.filter((tx) => isInMonth(tx.occurredAt, month));
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const usage: BudgetUsage[] = limits.map((limit) => ({
    categoryId: limit.categoryId,
    categoryName: nameById.get(limit.categoryId) ?? 'A category',
    limitMinor: limit.limitMinor,
    spentMinor: calculateMonthlySpending(monthTransactions.filter((tx) => tx.categoryId === limit.categoryId), month),
    currency: budget.currency,
  }));

  // Only this month's keys are kept, so the list never grows.
  const sent = new Set((parseList(sentRaw)).filter((key) => key.startsWith(`${month}:`)));
  const warnings = budgetWarnings(usage, month, sent);
  for (const warning of warnings) {
    await Notifications.scheduleNotificationAsync({ content: { title: warning.title, body: warning.body, data: { url: '/budgets' } }, trigger: null });
    sent.add(warning.key);
  }
  if (warnings.length > 0) await settingsRepository.setSetting(SENT_BUDGET_WARNINGS_KEY, JSON.stringify([...sent]));
}

function parseList(raw: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}
