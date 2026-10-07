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
import { useT } from '@/i18n';
import { setLanguage } from '@/i18n/languageSettings';

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
  const { t, language } = useT();
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
      setError(t('onb.balanceError'));
      return;
    }
    if (useBank && !bankName.trim()) {
      setError(t('onb.bankNameError'));
      return;
    }
    setIsSaving(true);
    const cashAccount = accounts.find((a) => a.type === 'cash');
    if (cashAccount) await accountsRepository.updateAccount(cashAccount.id, { initialBalanceMinor: cash, currency: defaultCurrency });
    else await accountsRepository.createAccount({ name: t('onb.cashAccount'), type: 'cash', currency: defaultCurrency, initialBalanceMinor: cash });
    if (useMomo) await accountsRepository.createAccount({ name: momoName.trim() || t('onb.momoAccount'), type: 'mobile_money', currency: defaultCurrency, initialBalanceMinor: momo });
    if (useBank) await accountsRepository.createAccount({ name: bankName.trim(), type: 'checking', currency: defaultCurrency, initialBalanceMinor: bank });
    await loadAll();
    setIsSaving(false);
    next('payday');
  };

  const savePayday = async () => {
    const amountMinor = parseMoneyInput(salary, defaultCurrency);
    if (amountMinor === null || amountMinor <= 0) {
      setError(t('onb.payError'));
      return;
    }
    setIsSaving(true);
    await incomeRepository.createIncomeSource({ source: t('onb.salary'), amountMinor, currency: defaultCurrency, frequency: 'monthly', nextExpectedAt: payday.toISOString() });
    setIsSaving(false);
    next('budget');
  };

  const createBudget = async () => {
    setIsSaving(true);
    const month = currentMonthKey();
    if (!(await budgetsRepository.getBudgetForMonth(month))) {
      await budgetsRepository.createBudget({
        name: t('budgets.defaultName'),
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
              {t('onb.step', { index: stepIndex + 1, count: STEPS.length })}
            </Caption>
            <Pressable onPress={finish} accessibilityRole="button" hitSlop={8} className="min-h-[44px] justify-center">
              <Caption className="font-sans-semibold text-accent-secondary">{t('onb.skip')}</Caption>
            </Pressable>
          </View>
        ) : null}

        {step === 'welcome' ? (
          <View className="flex-1 justify-center gap-lg">
            <Text accessibilityRole="header" className="font-display text-[44px] leading-[46px] text-text-primary">
              F-AI
            </Text>
            <Heading>{t('onb.tagline')}</Heading>
            {[
              ['wallet-outline', t('onb.point1')],
              ['calendar-outline', t('onb.point2')],
              ['sparkles-outline', t('onb.point3')],
            ].map(([icon, text]) => (
              <View key={text} className="flex-row items-center gap-md">
                <Ionicons name={icon as 'wallet-outline'} size={22} color={colors.accent} />
                <Body className="flex-1">{text}</Body>
              </View>
            ))}
            <Caption>{t('onb.privacy')}</Caption>
            <View className="flex-row gap-sm">
              {(['en', 'fr'] as const).map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setLanguage(option)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: language === option }}
                  className={language === option ? 'flex-1 items-center rounded-sm border border-accent bg-accent-muted py-sm' : 'flex-1 items-center rounded-sm border border-border bg-surface py-sm'}
                >
                  <Caption className={language === option ? 'text-accent-secondary' : undefined}>{t(`settings.language.${option}`)}</Caption>
                </Pressable>
              ))}
            </View>
            <Button label={t('onb.start')} onPress={() => next('currency')} />
            <Pressable onPress={finish} accessibilityRole="button" className="items-center py-sm">
              <Caption className="font-sans-semibold text-accent-secondary">{t('onb.skip')}</Caption>
            </Pressable>
          </View>
        ) : null}

        {step === 'currency' ? (
          <View className="gap-lg">
            <Heading>{t('onb.currencyTitle')}</Heading>
            <ChipGroup<CurrencyCode>
              options={Object.values(CURRENCIES).map((c) => ({ id: c.code, label: `${c.code} · ${c.symbol}` }))}
              selectedId={defaultCurrency}
              onSelect={setDefaultCurrency}
            />
            <Caption>{t('onb.changeLater')}</Caption>
            <Button label={t('onb.continue')} onPress={() => next('accounts')} />
          </View>
        ) : null}

        {step === 'accounts' ? (
          <View className="gap-lg">
            <Heading>{t('onb.accountsTitle')}</Heading>
            <BodySmall>{t('onb.accountsHint')}</BodySmall>
            <View className="gap-sm">
              <Label>{t('onb.cash', { currency: defaultCurrency })}</Label>
              {input(cashBalance, setCashBalance, '0', t('onb.cashA11y'))}
            </View>
            {toggle(useMomo, () => setUseMomo((v) => !v), t('onb.useMomo'))}
            {useMomo ? (
              <View className="gap-sm">
                {input(momoName, setMomoName, t('onb.momoPlaceholder'), t('onb.momoNameA11y'), false)}
                {input(momoBalance, setMomoBalance, t('onb.balance', { currency: defaultCurrency }), t('onb.momoBalanceA11y'))}
              </View>
            ) : null}
            {toggle(useBank, () => setUseBank((v) => !v), t('onb.useBank'))}
            {useBank ? (
              <View className="gap-sm">
                {input(bankName, setBankName, t('onb.bankPlaceholder'), t('onb.bankNameA11y'), false)}
                {input(bankBalance, setBankBalance, t('onb.balance', { currency: defaultCurrency }), t('onb.bankBalanceA11y'))}
              </View>
            ) : null}
            {error ? <Caption className="text-danger">{error}</Caption> : null}
            <Button label={isSaving ? t('common.saving') : t('onb.continue')} onPress={saveAccounts} disabled={isSaving} />
          </View>
        ) : null}

        {step === 'payday' ? (
          <View className="gap-lg">
            <Heading>{t('onb.paydayTitle')}</Heading>
            <BodySmall>{t('onb.paydayHint')}</BodySmall>
            <View className="gap-sm">
              <Label>{t('onb.pay', { currency: defaultCurrency })}</Label>
              {input(salary, setSalary, '0', t('onb.payA11y'))}
            </View>
            <DateField label={t('onb.nextPayday')} value={payday} onChange={setPayday} minimumDate={new Date()} />
            {error ? <Caption className="text-danger">{error}</Caption> : null}
            <Button label={isSaving ? t('common.saving') : t('onb.continue')} onPress={savePayday} disabled={isSaving} />
            <Button label={t('onb.skipStep')} variant="secondary" onPress={() => next('budget')} />
          </View>
        ) : null}

        {step === 'budget' ? (
          <View className="gap-lg">
            <Heading>{t('onb.budgetTitle')}</Heading>
            <BodySmall>{t('onb.budgetHint')}</BodySmall>
            <Button label={isSaving ? t('budgets.creating') : t('onb.createBudget')} onPress={createBudget} disabled={isSaving} />
            <Button label={t('onb.notNow')} variant="secondary" onPress={() => next('done')} />
          </View>
        ) : null}

        {step === 'done' ? (
          <View className="flex-1 justify-center gap-lg">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-success-muted">
              <Ionicons name="checkmark" size={36} color={colors.success} />
            </View>
            <Heading>{t('onb.doneTitle')}</Heading>
            <BodySmall>{t('onb.doneHint')}</BodySmall>
            <Button label={t('common.goToOverview')} onPress={finish} />
          </View>
        ) : null}
    </FormScrollView>
  );
}
