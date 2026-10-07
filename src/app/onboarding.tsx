import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { FormScrollView } from '@/components/keyboard/keyboard';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, BodySmall, Button, Caption, ChipGroup, Heading, Label } from '@/components/ui';
import { DateField } from '@/components/ui/DateField';
import { accountsRepository, budgetsRepository, incomeRepository } from '@/database/repositories';
import { useFinanceStore } from '@/store/financeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useOnboardingStore } from '@/features/onboarding/onboarding.store';
import { CURRENCIES, type CurrencyCode } from '@/constants/currencies';
import { useThemeColors } from '@/constants/theme';
import { majorToMinor, parseMoneyInput } from '@/utils/currency';
import { currentMonthKey } from '@/utils/months';

const STEPS = ['currency', 'accounts', 'payday', 'budget'] as const;
type Step = 'welcome' | (typeof STEPS)[number] | 'done';
const DEFAULT_CATEGORY_LIMIT_MAJOR = 20_000;

/**
 * First-run setup, about a minute: currency, accounts with real starting
 * balances, an optional payday, and a first budget. Every step can be
 * skipped; nothing here is required to use the app. Shown once (see
 * needsOnboarding).
 */
export default function OnboardingScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { accounts, categories, loadAll } = useFinanceStore();
  const { defaultCurrency, setDefaultCurrency } = useSettingsStore();
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);
  const [step, setStep] = useState<Step>('welcome');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Accounts step
  const [cashBalance, setCashBalance] = useState('');
  const [useMomo, setUseMomo] = useState(true);
  const [momoName, setMomoName] = useState('MTN MoMo');
  const [momoBalance, setMomoBalance] = useState('');
  const [useBank, setUseBank] = useState(false);
  const [bankName, setBankName] = useState('');
  const [bankBalance, setBankBalance] = useState('');
  // Payday step
  const [salary, setSalary] = useState('');
  const [payday, setPayday] = useState(new Date());

  const stepIndex = STEPS.indexOf(step as (typeof STEPS)[number]);
  const next = (to: Step) => {
    setError(null);
    Haptics.selectionAsync();
    setStep(to);
  };

  const finish = async () => {
    await completeOnboarding();
    await loadAll();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/');
  };

  const saveAccounts = async () => {
    const parse = (text: string) => (text.trim() ? parseMoneyInput(text, defaultCurrency) : 0);
    const cash = parse(cashBalance);
    const momo = parse(momoBalance);
    const bank = parse(bankBalance);
    if (cash === null || momo === null || bank === null) {
      setError('Balances must be numbers, e.g. 25000. Leave a field empty for 0.');
      return;
    }
    if (useBank && !bankName.trim()) {
      setError('Name your bank account, e.g. "Afriland".');
      return;
    }
    setIsSaving(true);
    const cashAccount = accounts.find((a) => a.type === 'cash');
    if (cashAccount) await accountsRepository.updateAccount(cashAccount.id, { initialBalanceMinor: cash, currency: defaultCurrency });
    else await accountsRepository.createAccount({ name: 'Cash', type: 'cash', currency: defaultCurrency, initialBalanceMinor: cash });
    if (useMomo) await accountsRepository.createAccount({ name: momoName.trim() || 'Mobile money', type: 'mobile_money', currency: defaultCurrency, initialBalanceMinor: momo });
    if (useBank) await accountsRepository.createAccount({ name: bankName.trim(), type: 'checking', currency: defaultCurrency, initialBalanceMinor: bank });
    await loadAll();
    setIsSaving(false);
    next('payday');
  };

  const savePayday = async () => {
    const amountMinor = parseMoneyInput(salary, defaultCurrency);
    if (amountMinor === null || amountMinor <= 0) {
      setError('Enter your usual pay, or tap Skip.');
      return;
    }
    setIsSaving(true);
    await incomeRepository.createIncomeSource({ source: 'Salary', amountMinor, currency: defaultCurrency, frequency: 'monthly', nextExpectedAt: payday.toISOString() });
    setIsSaving(false);
    next('budget');
  };

  const createBudget = async () => {
    setIsSaving(true);
    const month = currentMonthKey();
    if (!(await budgetsRepository.getBudgetForMonth(month))) {
      await budgetsRepository.createBudget({
        name: 'Monthly budget',
        month,
        currency: defaultCurrency,
        categories: categories
          .filter((c) => c.type === 'expense')
          .map((c) => ({ categoryId: c.id, limitMinor: majorToMinor(DEFAULT_CATEGORY_LIMIT_MAJOR, defaultCurrency) })),
      });
    }
    setIsSaving(false);
    next('done');
  };

  const input = (value: string, onChange: (t: string) => void, placeholder: string, label: string, numeric = true) => (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors['text-muted']}
      keyboardType={numeric ? 'decimal-pad' : 'default'}
      accessibilityLabel={label}
      className="rounded-md border border-border-strong bg-surface px-md py-md text-text-primary"
    />
  );

  const toggle = (checked: boolean, onPress: () => void, label: string) => (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked }} className="min-h-[44px] flex-row items-center gap-sm">
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? colors.accent : colors['text-muted']} />
      <Body>{label}</Body>
    </Pressable>
  );

  return (
    <FormScrollView
      className="flex-1 bg-background"
      contentContainerClassName="flex-grow gap-lg px-lg"
      contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) + 16 }}
    >
        {stepIndex >= 0 ? (
          <View className="flex-row items-center justify-between">
            <Caption>
              Step {stepIndex + 1} of {STEPS.length}
            </Caption>
            <Pressable onPress={finish} accessibilityRole="button" hitSlop={8} className="min-h-[44px] justify-center">
              <Caption className="font-sans-semibold text-accent-secondary">Skip setup</Caption>
            </Pressable>
          </View>
        ) : null}

        {step === 'welcome' ? (
          <View className="flex-1 justify-center gap-lg">
            <Text accessibilityRole="header" className="font-display text-[44px] leading-[46px] text-text-primary">
              F-AI
            </Text>
            <Heading>Know what you can spend, every day.</Heading>
            {[
              ['wallet-outline', 'Cash, mobile money and bank in one place'],
              ['calendar-outline', 'Bills and debts set aside before you spend'],
              ['sparkles-outline', 'A copilot that only uses your real numbers'],
            ].map(([icon, text]) => (
              <View key={text} className="flex-row items-center gap-md">
                <Ionicons name={icon as 'wallet-outline'} size={22} color={colors.accent} />
                <Body className="flex-1">{text}</Body>
              </View>
            ))}
            <Caption>Your data stays on this phone. Setup takes about a minute.</Caption>
            <Button label="Get started" onPress={() => next('currency')} />
            <Pressable onPress={finish} accessibilityRole="button" className="items-center py-sm">
              <Caption className="font-sans-semibold text-accent-secondary">Skip setup</Caption>
            </Pressable>
          </View>
        ) : null}

        {step === 'currency' ? (
          <View className="gap-lg">
            <Heading>Which currency do you use?</Heading>
            <ChipGroup<CurrencyCode>
              options={Object.values(CURRENCIES).map((c) => ({ id: c.code, label: `${c.code} · ${c.symbol}` }))}
              selectedId={defaultCurrency}
              onSelect={setDefaultCurrency}
            />
            <Caption>You can change this later in Settings.</Caption>
            <Button label="Continue" onPress={() => next('accounts')} />
          </View>
        ) : null}

        {step === 'accounts' ? (
          <View className="gap-lg">
            <Heading>Where is your money right now?</Heading>
            <BodySmall>Enter today&rsquo;s balances so F-AI starts from your real numbers. Leave a field empty for 0.</BodySmall>
            <View className="gap-sm">
              <Label>Cash on hand ({defaultCurrency})</Label>
              {input(cashBalance, setCashBalance, '0', 'Cash on hand')}
            </View>
            {toggle(useMomo, () => setUseMomo((v) => !v), 'I use mobile money')}
            {useMomo ? (
              <View className="gap-sm">
                {input(momoName, setMomoName, 'MTN MoMo, Orange Money', 'Mobile money account name', false)}
                {input(momoBalance, setMomoBalance, `Balance (${defaultCurrency})`, 'Mobile money balance')}
              </View>
            ) : null}
            {toggle(useBank, () => setUseBank((v) => !v), 'I have a bank account')}
            {useBank ? (
              <View className="gap-sm">
                {input(bankName, setBankName, 'e.g. Afriland, Ecobank', 'Bank name', false)}
                {input(bankBalance, setBankBalance, `Balance (${defaultCurrency})`, 'Bank balance')}
              </View>
            ) : null}
            {error ? <Caption className="text-danger">{error}</Caption> : null}
            <Button label={isSaving ? 'Saving…' : 'Continue'} onPress={saveAccounts} disabled={isSaving} />
          </View>
        ) : null}

        {step === 'payday' ? (
          <View className="gap-lg">
            <Heading>When do you get paid?</Heading>
            <BodySmall>With a payday, Overview shows how much you can spend each day until then.</BodySmall>
            <View className="gap-sm">
              <Label>Usual monthly pay ({defaultCurrency})</Label>
              {input(salary, setSalary, '0', 'Usual monthly pay')}
            </View>
            <DateField label="Next payday" value={payday} onChange={setPayday} minimumDate={new Date()} />
            {error ? <Caption className="text-danger">{error}</Caption> : null}
            <Button label={isSaving ? 'Saving…' : 'Continue'} onPress={savePayday} disabled={isSaving} />
            <Button label="Skip" variant="secondary" onPress={() => next('budget')} />
          </View>
        ) : null}

        {step === 'budget' ? (
          <View className="gap-lg">
            <Heading>Start a budget for this month?</Heading>
            <BodySmall>
              Each spending category starts with a limit you can change any time on the Budgets tab. Alerts tell you when a category goes over.
            </BodySmall>
            <Button label={isSaving ? 'Creating…' : 'Create my budget'} onPress={createBudget} disabled={isSaving} />
            <Button label="Not now" variant="secondary" onPress={() => next('done')} />
          </View>
        ) : null}

        {step === 'done' ? (
          <View className="flex-1 justify-center gap-lg">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-success-muted">
              <Ionicons name="checkmark" size={36} color={colors.success} />
            </View>
            <Heading>You&rsquo;re set up</Heading>
            <BodySmall>Add transactions as you spend, or import them from your mobile money SMS on the Transactions tab.</BodySmall>
            <Button label="Go to Overview" onPress={finish} />
          </View>
        ) : null}
    </FormScrollView>
  );
}
