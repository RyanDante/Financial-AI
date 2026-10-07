import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AmountText, Badge, Body, BodySmall, Button, Caption, Card, ChipGroup, Label } from '@/components/ui';
import { transactionsRepository } from '@/database/repositories';
import { useFinanceStore } from '@/store/financeStore';
import { calculateBalance } from '@/finance/calculations';
import { parseMomoSms, referenceNote, splitMessages, type MomoKind, type MomoParseResult } from '@/features/momo/parseMomoSms';
import { extractMomoWithAI } from '@/features/momo/aiExtract';
import { pickImageFromLibrary, type PickedFile } from '@/features/attachments/attachments.service';
import { prepareImageForAI } from '@/features/images/prepareForAI';
import { aiClient, providerLabel } from '@/ai';
import { useThemeColors } from '@/constants/theme';
import { formatMoney } from '@/utils/currency';
import type { CurrencyCode } from '@/constants/currencies';
import type { NewTransaction, Transaction } from '@/types/finance';
import { FormScrollView } from '@/components/keyboard/keyboard';
import { categoryLabel, getLocale, t as translate, useT, type MessageKey } from '@/i18n';

type Direction = 'expense' | 'income';
/** Who read the message: the offline rules, the AI from text, or the AI from a screenshot. */
type ReadBy = 'rules' | 'ai' | 'image';

interface Draft {
  key: string;
  parsed: MomoParseResult;
  include: boolean;
  direction: Direction;
  accountId: string | null;
  categoryId: string | null;
  recordFee: boolean;
  duplicate: boolean;
  readBy: ReadBy;
}

const KIND_LABELS: Record<MomoKind, MessageKey> = {
  received: 'sms.kind.received',
  sent: 'sms.kind.sent',
  payment: 'sms.kind.payment',
  withdrawal: 'sms.kind.withdrawal',
  deposit: 'sms.kind.deposit',
};
const INCOME_KINDS: MomoKind[] = ['received', 'deposit'];
/** MTN MoMo and Orange Money messages are always in FCFA, whatever the app currency. */
const SMS_CURRENCY: CurrencyCode = 'XAF';

/**
 * Turns MTN MoMo / Orange Money SMS into transactions. Every message
 * becomes a card to check (amount, type, account, category, fee) and
 * nothing is saved until "Save". A message whose reference was already
 * imported is unticked and marked, so pasting the same SMS twice doesn't
 * double-count.
 *
 * Messages are read offline by rules first. With an AI provider set up,
 * "Read with AI" and "Scan a screenshot" let the model read them instead;
 * amounts it reads from text must appear in the SMS (see aiExtract.ts).
 * Opened with `text` or `image` params (Share to F-AI), it reads them at once.
 */
export default function ImportSmsScreen() {
  const colors = useThemeColors();
  const { t, tn } = useT();
  const { accounts, categories, loadAll } = useFinanceStore();
  const params = useLocalSearchParams<{ text?: string; image?: string }>();
  const [paste, setPaste] = useState(params.text ?? '');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const sharedHandled = useRef(false);

  useEffect(() => {
    transactionsRepository.listTransactions({}).then(setAllTransactions);
  }, []);

  const momoAccount = accounts.find((a) => a.type === 'mobile_money') ?? accounts[0];
  const cashAccount = accounts.find((a) => a.type === 'cash' && a.id !== momoAccount?.id);
  const feeCategoryId = categories.find((c) => c.name === 'Bills')?.id ?? null;
  const importedRefs = useMemo(() => new Set(allTransactions.map((t) => t.notes).filter((n): n is string => !!n)), [allTransactions]);

  const toDraft = (parsed: MomoParseResult, i: number, readBy: ReadBy): Draft => {
    const duplicate = !!parsed.fields.reference && importedRefs.has(referenceNote(parsed.fields.reference));
    return {
      key: `${readBy}-${i}-${parsed.fields.reference ?? parsed.raw.length}`,
      parsed,
      include: parsed.ok && !duplicate,
      direction: parsed.fields.kind && INCOME_KINDS.includes(parsed.fields.kind) ? 'income' : 'expense',
      accountId: momoAccount?.id ?? null,
      categoryId: null,
      recordFee: (parsed.fields.fee ?? 0) > 0,
      duplicate,
      readBy,
    };
  };

  const readWithRules = (text: string) => {
    setAiError(null);
    setDrafts(splitMessages(text).map((message, i) => toDraft(parseMomoSms(message), i, 'rules')));
    Haptics.selectionAsync();
  };

  const readWithAI = async (input: { text?: string; image?: PickedFile }) => {
    if (!aiClient) return;
    setAiError(null);
    setAiBusy(input.image ? t('sms.readingScreenshot') : t('sms.readingMessages'));
    try {
      const image = input.image ? await prepareImageForAI(input.image) : undefined;
      const results = await extractMomoWithAI(aiClient, { text: input.text, image });
      if (results.length === 0) setAiError(t('sms.noneFound'));
      setDrafts(results.map((result, i) => toDraft(result.parsed, i, result.fromImage ? 'image' : 'ai')));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      if (__DEV__) console.warn('[sms] AI read failed', error);
      const reason = error instanceof Error ? error.message : 'unknown error';
      setAiError(t('sms.aiFailed', { reason }));
    } finally {
      setAiBusy(null);
    }
  };

  const scanScreenshot = async () => {
    const file = await pickImageFromLibrary();
    if (file) await readWithAI({ image: file });
  };

  // Shared to F-AI (text or a screenshot): read it once the accounts have loaded.
  useEffect(() => {
    if (sharedHandled.current || accounts.length === 0 || (!params.text && !params.image)) return;
    const timer = setTimeout(() => {
      sharedHandled.current = true;
      if (params.image && aiClient) readWithAI({ image: { uri: params.image, filename: 'shared.jpg', mimeType: 'image/jpeg', sizeBytes: null } });
      else if (params.text) {
        if (aiClient) readWithAI({ text: params.text });
        else readWithRules(params.text);
      }
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, when the accounts are first loaded
  }, [accounts.length]);

  const update = (key: string, patch: Partial<Draft>) => setDrafts((all) => all.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const selected = drafts.filter((d) => d.include && d.parsed.ok && d.accountId);

  const save = async () => {
    setIsSaving(true);
    for (const draft of selected) {
      for (const tx of toTransactions(draft, cashAccount?.id ?? null, feeCategoryId)) await transactionsRepository.createTransaction(tx);
    }
    await loadAll();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <FormScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg pb-3xl">
      <View className="gap-sm">
        <Label>{t('sms.pasteLabel')}</Label>
        <TextInput
          value={paste}
          onChangeText={setPaste}
          multiline
          textAlignVertical="top"
          placeholder={t('sms.placeholder')}
          placeholderTextColor={colors['text-muted']}
          accessibilityLabel={t('sms.pasteA11y')}
          className="min-h-[120px] rounded-md border border-border-strong bg-surface px-md py-md text-text-primary"
        />
        <Caption>
          {aiClient
            ? t('sms.aiNote', { provider: providerLabel() })
            : t('sms.offlineNote')}
        </Caption>
        <View className="flex-row gap-sm">
          <View className="flex-1">
            <Button label={t('sms.read')} variant="secondary" onPress={() => readWithRules(paste)} disabled={!paste.trim() || !!aiBusy} />
          </View>
          {aiClient ? (
            <View className="flex-1">
              <Button label={t('sms.readAI')} variant="secondary" onPress={() => readWithAI({ text: paste })} disabled={!paste.trim() || !!aiBusy} />
            </View>
          ) : null}
        </View>
        {aiClient ? (
          <Pressable
            onPress={scanScreenshot}
            disabled={!!aiBusy}
            accessibilityRole="button"
            className="min-h-[44px] flex-row items-center justify-center gap-sm rounded-md border border-dashed border-border-strong px-md"
          >
            <Ionicons name="image-outline" size={18} color={colors['text-primary']} />
            <BodySmall>{t('sms.scan')}</BodySmall>
          </Pressable>
        ) : null}
        {aiBusy ? (
          <View className="flex-row items-center gap-sm" accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={colors['accent-secondary']} />
            <Caption>{aiBusy}</Caption>
          </View>
        ) : null}
        {aiError ? <Caption className="text-danger">{aiError}</Caption> : null}
      </View>

      {drafts.map((draft) => (
        <DraftCard
          key={draft.key}
          draft={draft}
          accounts={accounts}
          categories={categories}
          allTransactions={allTransactions}
          cashAccountName={cashAccount?.name ?? null}
          onChange={(patch) => update(draft.key, patch)}
        />
      ))}

      {drafts.length > 0 ? (
        <Button
          label={isSaving ? t('common.saving') : tn('sms.save', selected.length)}
          onPress={save}
          disabled={isSaving || selected.length === 0}
        />
      ) : null}
    </FormScrollView>
  );
}

function DraftCard({
  draft,
  accounts,
  categories,
  allTransactions,
  cashAccountName,
  onChange,
}: {
  draft: Draft;
  accounts: ReturnType<typeof useFinanceStore.getState>['accounts'];
  categories: ReturnType<typeof useFinanceStore.getState>['categories'];
  allTransactions: Transaction[];
  cashAccountName: string | null;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const colors = useThemeColors();
  const { t } = useT();
  const { fields, ok, confidence } = draft.parsed;
  const account = accounts.find((a) => a.id === draft.accountId);
  const isWithdrawal = fields.kind === 'withdrawal';
  const relevantCategories = categories.filter((c) => c.type === draft.direction);
  const appBalance = account ? calculateBalance(account, allTransactions) : null;

  if (!ok) {
    return (
      <Card className="gap-xs">
        <Badge label={t('sms.notRecognised')} tone="warning" />
        <BodySmall numberOfLines={3}>{draft.parsed.raw}</BodySmall>
        <Caption>
          {draft.readBy === 'rules' ? t('sms.noAmount') : t('sms.amountUnconfirmed')}
        </Caption>
      </Card>
    );
  }

  return (
    <Card className="gap-md" style={{ opacity: draft.include ? 1 : 0.6 }}>
      <View className="flex-row items-start justify-between gap-md">
        <View className="flex-1 gap-xs">
          <View className="flex-row flex-wrap gap-xs">
            <Badge label={fields.kind ? t(KIND_LABELS[fields.kind]) : t('sms.typeUnclear')} tone={fields.kind ? 'accent' : 'warning'} />
            {draft.readBy === 'ai' ? <Badge label={t('sms.readByAI')} tone="neutral" /> : null}
            {draft.readBy === 'image' ? <Badge label={t('sms.fromScreenshot')} tone="warning" /> : null}
            {draft.duplicate ? <Badge label={t('sms.alreadyImported')} tone="neutral" /> : null}
            {confidence === 'low' ? <Badge label={t('sms.checkDetails')} tone="warning" /> : null}
          </View>
          <AmountText valueMinor={fields.amount ?? 0} currency={SMS_CURRENCY} size="md" tone={draft.direction === 'income' ? 'success' : 'primary'} />
          {fields.counterparty ? <Body numberOfLines={1}>{fields.counterparty}</Body> : null}
          <Caption>
            {fields.occurredAt ? new Date(fields.occurredAt).toLocaleString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : t('sms.noDate')}
            {fields.reference ? t('sms.ref', { ref: fields.reference }) : ''}
          </Caption>
        </View>
        <Pressable
          onPress={() => onChange({ include: !draft.include })}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: draft.include }}
          accessibilityLabel={t('sms.importA11y')}
          hitSlop={8}
          className="h-11 w-11 items-center justify-center"
        >
          <Ionicons name={draft.include ? 'checkbox' : 'square-outline'} size={24} color={draft.include ? colors.accent : colors['text-muted']} />
        </Pressable>
      </View>

      {draft.include ? (
        <>
          {isWithdrawal ? (
            <Caption>{cashAccountName ? t('sms.transferNote', { from: account?.name ?? 'MoMo', to: cashAccountName }) : t('sms.expenseNote')}</Caption>
          ) : (
            <ChipGroup<Direction>
              options={[
                { id: 'expense', label: t('sms.moneyOut') },
                { id: 'income', label: t('sms.moneyIn') },
              ]}
              selectedId={draft.direction}
              onSelect={(direction) => onChange({ direction, categoryId: null })}
            />
          )}

          {accounts.length > 1 ? (
            <View className="gap-xs">
              <Caption>{t('sms.account')}</Caption>
              <ChipGroup options={accounts.map((a) => ({ id: a.id, label: a.name }))} selectedId={draft.accountId} onSelect={(accountId) => onChange({ accountId })} />
            </View>
          ) : null}

          {!isWithdrawal || !cashAccountName ? (
            <View className="gap-xs">
              <Caption>{t('sms.category')}</Caption>
              <ChipGroup options={relevantCategories.map((c) => ({ id: c.id, label: categoryLabel(c.name) }))} selectedId={draft.categoryId} onSelect={(categoryId) => onChange({ categoryId })} />
            </View>
          ) : null}

          {(fields.fee ?? 0) > 0 ? (
            <Pressable
              onPress={() => onChange({ recordFee: !draft.recordFee })}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: draft.recordFee }}
              className="min-h-[44px] flex-row items-center gap-sm"
            >
              <Ionicons name={draft.recordFee ? 'checkbox' : 'square-outline'} size={20} color={draft.recordFee ? colors.accent : colors['text-muted']} />
              <BodySmall>{t('sms.recordFee', { amount: formatMoney(fields.fee ?? 0, SMS_CURRENCY) })}</BodySmall>
            </Pressable>
          ) : null}

          {fields.balance !== null && appBalance !== null && account?.currency === SMS_CURRENCY && fields.balance !== appBalance ? (
            <Caption className="text-warning">
              {t('sms.balanceMismatch', { sms: formatMoney(fields.balance, SMS_CURRENCY), app: formatMoney(appBalance, SMS_CURRENCY), account: account.name })}
            </Caption>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

/** One SMS → its transaction, plus a separate fee expense when asked. */
function toTransactions(draft: Draft, cashAccountId: string | null, feeCategoryId: string | null): NewTransaction[] {
  const { fields } = draft.parsed;
  if (!draft.accountId || !fields.amount) return [];
  const notes = fields.reference ? referenceNote(fields.reference) : null;
  const occurredAt = fields.occurredAt ?? new Date().toISOString();
  const base = { accountId: draft.accountId, amountMinor: fields.amount, currency: SMS_CURRENCY, occurredAt, notes, source: 'import' as const, description: null };

  const main: NewTransaction =
    fields.kind === 'withdrawal' && cashAccountId
      ? { ...base, type: 'transfer', transferAccountId: cashAccountId, categoryId: null, merchant: null, description: translate('sms.cashOut') }
      : { ...base, type: draft.direction, transferAccountId: null, categoryId: draft.categoryId, merchant: fields.counterparty };

  const fee: NewTransaction[] =
    draft.recordFee && (fields.fee ?? 0) > 0
      ? [{ ...base, amountMinor: fields.fee ?? 0, type: 'expense', transferAccountId: null, categoryId: feeCategoryId, merchant: translate('sms.fee'), notes: notes ? `${notes} fee` : null }]
      : [];
  return [main, ...fee];
}
