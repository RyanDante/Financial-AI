import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { aiClient, providerLabel } from '@/ai';
import { useAuthStore } from '@/features/auth/auth.store';
import { attachFileToEntity, pickImageFromLibrary, takePhoto, type PickedFile } from '@/features/attachments/attachments.service';
import { prepareImageForAI } from '@/features/images/prepareForAI';
import { scanReceipt } from '@/features/receipts/scanReceipt';
import { Body, Button, Caption, Label } from '@/components/ui';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { DateField } from '@/components/ui/DateField';
import { transactionsRepository } from '@/database/repositories';
import { useFinanceStore } from '@/store/financeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { formatMoney, parseMoneyInput } from '@/utils/currency';
import { cn } from '@/utils/cn';
import type { Transaction, TransactionType } from '@/types/finance';
import { useThemeColors } from '@/constants/theme';
import { FormScrollView } from '@/components/keyboard/keyboard';
import { categoryLabel, useT, type MessageKey } from '@/i18n';

/**
 * Add a transaction, or edit one when opened with `?id=` (from the
 * transaction detail screen). Editing keeps the original currency and
 * source; everything else, including the date, can change. A transfer moves
 * money between two of your accounts: it changes both balances but is not
 * spending or income, so it has no category.
 */
const TYPE_LABELS: Record<TransactionType, MessageKey> = { expense: 'type.expense', income: 'type.income', transfer: 'type.transfer' };

export default function NewTransactionScreen() {
  // `id` opens the form in edit mode; `categoryId`/`merchant` prefill a new expense (from Home's suggestions).
  const { id, categoryId: prefillCategoryId, merchant: prefillMerchant } = useLocalSearchParams<{ id?: string; categoryId?: string; merchant?: string }>();
  const isEditing = Boolean(id);
  const colors = useThemeColors();
  const { t } = useT();
  const { accounts, categories, addTransaction, updateTransaction } = useFinanceStore();
  const defaultCurrency = useSettingsStore((s) => s.defaultCurrency);
  const [existing, setExisting] = useState<Transaction | null>(null);
  const [type, setType] = useState<TransactionType>('expense');
  const [amountInput, setAmountInput] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(prefillCategoryId ?? null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [transferAccountId, setTransferAccountId] = useState<string | null>(null);
  const [occurredAt, setOccurredAt] = useState(new Date());
  const [merchant, setMerchant] = useState(prefillMerchant ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const authUser = useAuthStore((s) => s.user);
  // Receipt scanning (new expenses only, with an AI provider set up).
  const [receipt, setReceipt] = useState<PickedFile | null>(null);
  const [attachReceipt, setAttachReceipt] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanNote, setScanNote] = useState<{ tone: 'info' | 'warning' | 'danger'; text: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    let isCurrent = true;
    (async () => {
      const tx = await transactionsRepository.getTransactionById(id);
      if (!isCurrent || !tx) return;
      setExisting(tx);
      setType(tx.type);
      // formatMoney without a symbol gives "12,500" / "1,500.50", which parseMoneyInput reads back.
      setAmountInput(formatMoney(tx.amountMinor, tx.currency, { showSymbol: false }));
      setCategoryId(tx.categoryId);
      setAccountId(tx.accountId);
      setTransferAccountId(tx.transferAccountId);
      setOccurredAt(new Date(tx.occurredAt));
      setMerchant(tx.merchant ?? '');
    })();
    return () => {
      isCurrent = false;
    };
  }, [id]);

  const currency = existing?.currency ?? defaultCurrency;
  const relevantCategories = categories.filter((c) => c.type === (type === 'income' ? 'income' : 'expense'));
  const selectedAccountId = accountId ?? accounts[0]?.id ?? null;
  const isTransfer = type === 'transfer';
  const types: TransactionType[] = accounts.length > 1 || isTransfer ? ['expense', 'income', 'transfer'] : ['expense', 'income'];
  const accountName = (accountIdToFind: string | null) => accounts.find((a) => a.id === accountIdToFind)?.name ?? 'account';
  const canScan = !isEditing && !!aiClient && type === 'expense';

  /** Reads a receipt photo and fills the form; the user checks everything before saving. */
  const scan = async (pick: () => Promise<PickedFile | null>) => {
    if (!aiClient) return;
    const file = await pick();
    if (!file) return;
    setIsScanning(true);
    setScanNote(null);
    try {
      const result = await scanReceipt(aiClient, await prepareImageForAI(file), relevantCategories);
      setReceipt(file);
      setAmountInput(String(result.total));
      if (result.merchant) setMerchant(result.merchant);
      if (result.categoryId) setCategoryId(result.categoryId);
      if (result.date) setOccurredAt(new Date(result.date));
      setScanNote(
        result.currency && result.currency !== currency
          ? { tone: 'warning', text: t('txForm.receiptOtherCurrency', { receipt: result.currency, currency }) }
          : { tone: 'info', text: t('txForm.receiptFilled') },
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (scanError) {
      if (__DEV__) console.warn('[receipt] scan failed', scanError);
      setScanNote({ tone: 'danger', text: t('txForm.receiptFailed', { reason: scanError instanceof Error ? scanError.message : t('txForm.receiptUnreadable') }) });
    } finally {
      setIsScanning(false);
    }
  };

  const handleSave = async () => {
    const amountMinor = parseMoneyInput(amountInput, currency);
    if (amountMinor === null || amountMinor <= 0) {
      setError(t('txForm.amountError'));
      return;
    }
    if (!selectedAccountId) {
      setError(t('txForm.noAccount'));
      return;
    }
    if (isTransfer && (!transferAccountId || transferAccountId === selectedAccountId)) {
      setError(t('txForm.sameAccount'));
      return;
    }

    setIsSaving(true);
    const fields = {
      accountId: selectedAccountId,
      transferAccountId: isTransfer ? transferAccountId : null,
      categoryId: isTransfer ? null : categoryId,
      amountMinor,
      type,
      merchant: isTransfer ? null : merchant.trim() || null,
      description: isTransfer ? `${accountName(selectedAccountId)} → ${accountName(transferAccountId)}` : (existing?.description ?? null),
      occurredAt: occurredAt.toISOString(),
    };
    if (isEditing && id) {
      await updateTransaction(id, fields);
    } else {
      const saved = await addTransaction({ ...fields, currency, notes: null, source: 'manual' });
      if (receipt && attachReceipt && !isTransfer) {
        // Best effort: the transaction is saved even if the photo can't be attached.
        await attachFileToEntity('transaction', saved.id, receipt, authUser?.uid ?? null).catch(() => {});
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  if (isEditing && !existing) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Caption>{t('common.loading')}</Caption>
      </View>
    );
  }

  return (
    <FormScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg">
      <Stack.Screen options={{ title: isEditing ? t('nav.editTransaction') : t('nav.addTransaction') }} />

      <View className="flex-row gap-sm">
        {types.map((option) => (
          <Pressable
            key={option}
            onPress={() => {
              setType(option);
              setCategoryId(null);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: type === option }}
            className={cn('flex-1 items-center rounded-md border py-md', type === option ? 'border-accent bg-accent-muted' : 'border-border bg-surface')}
          >
            <Body className={type === option ? 'text-accent-secondary' : undefined}>{t(TYPE_LABELS[option])}</Body>
          </Pressable>
        ))}
      </View>

      {canScan ? (
        <View className="gap-sm rounded-md border border-dashed border-border-strong p-md">
          <View className="flex-row items-center gap-sm">
            <Ionicons name="receipt-outline" size={20} color={colors['accent-secondary']} />
            <Body className="flex-1">{t('txForm.scan')}</Body>
            {isScanning ? <ActivityIndicator size="small" color={colors['accent-secondary']} /> : null}
          </View>
          <View className="flex-row gap-sm">
            <View className="flex-1">
              <Button label={t('txForm.camera')} variant="secondary" onPress={() => scan(takePhoto)} disabled={isScanning} />
            </View>
            <View className="flex-1">
              <Button label={t('txForm.photos')} variant="secondary" onPress={() => scan(pickImageFromLibrary)} disabled={isScanning} />
            </View>
          </View>
          {scanNote ? (
            <Caption className={scanNote.tone === 'danger' ? 'text-danger' : scanNote.tone === 'warning' ? 'text-warning' : undefined}>{scanNote.text}</Caption>
          ) : (
            <Caption>{t('txForm.scanPrivacy', { provider: providerLabel() })}</Caption>
          )}
          {receipt ? (
            <Pressable
              onPress={() => setAttachReceipt((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: attachReceipt }}
              className="min-h-[44px] flex-row items-center gap-sm"
            >
              <Ionicons name={attachReceipt ? 'checkbox' : 'square-outline'} size={20} color={attachReceipt ? colors.accent : colors['text-muted']} />
              <Caption>{t('txForm.attachReceipt')}</Caption>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View className="gap-sm">
        <Label>{t('txForm.amount', { currency })}</Label>
        <TextInput
          value={amountInput}
          onChangeText={setAmountInput}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors['text-muted']}
          className="rounded-md border border-border-strong bg-surface px-md py-md text-[22px] text-text-primary"
        />
      </View>

      {accounts.length > 1 ? (
        <View className="gap-sm">
          <Label>{isTransfer ? t('txForm.from') : t('txForm.account')}</Label>
          <ChipGroup options={accounts.map((a) => ({ id: a.id, label: a.name }))} selectedId={selectedAccountId} onSelect={setAccountId} />
        </View>
      ) : null}

      {isTransfer ? (
        <View className="gap-sm">
          <Label>{t('txForm.to')}</Label>
          <ChipGroup
            options={accounts.filter((a) => a.id !== selectedAccountId).map((a) => ({ id: a.id, label: a.name }))}
            selectedId={transferAccountId}
            onSelect={setTransferAccountId}
          />
          <Caption>{t('txForm.transferHint')}</Caption>
        </View>
      ) : (
        <>
          <View className="gap-sm">
            <Label>{t('txForm.category')}</Label>
            <ChipGroup options={relevantCategories.map((c) => ({ id: c.id, label: categoryLabel(c.name) }))} selectedId={categoryId} onSelect={setCategoryId} />
          </View>

          <View className="gap-sm">
            <Label>{t('txForm.merchant')}</Label>
            <TextInput
              value={merchant}
              onChangeText={setMerchant}
              placeholder={t('txForm.merchantPlaceholder')}
              placeholderTextColor={colors['text-muted']}
              className="rounded-md border border-border-strong bg-surface px-md py-md text-text-primary"
            />
          </View>
        </>
      )}

      <DateField label={t('txForm.date')} value={occurredAt} onChange={setOccurredAt} maximumDate={new Date()} />

      {error ? <Caption className="text-danger">{error}</Caption> : null}

      <Button label={isSaving ? t('common.saving') : t('txForm.save')} className="mt-sm" onPress={handleSave} disabled={isSaving} />
    </FormScrollView>
  );
}
