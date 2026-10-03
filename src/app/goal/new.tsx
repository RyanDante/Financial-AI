import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Caption, Heading, Label } from '@/components/ui';
import { goalsRepository } from '@/database/repositories';
import { useFinanceStore } from '@/store/financeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { parseMoneyInput } from '@/utils/currency';

export default function NewGoalScreen() {
  const currency = useSettingsStore((s) => s.defaultCurrency);
  const loadAll = useFinanceStore((s) => s.loadAll);
  const [name, setName] = useState('');
  const [targetInput, setTargetInput] = useState('');
  const [currentInput, setCurrentInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const targetAmountMinor = parseMoneyInput(targetInput, currency);
    const currentAmountMinor = currentInput ? parseMoneyInput(currentInput, currency) : 0;
    if (!name.trim()) {
      setError('Give your goal a name.');
      return;
    }
    if (targetAmountMinor === null || targetAmountMinor <= 0) {
      setError('Enter a valid target amount.');
      return;
    }

    setIsSaving(true);
    await goalsRepository.createGoal({
      name: name.trim(),
      targetAmountMinor,
      currentAmountMinor: currentAmountMinor ?? 0,
      currency,
      icon: 'flag',
    });
    await loadAll();
    router.back();
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-lg p-lg">
      <Heading>New goal</Heading>

      <View className="gap-sm">
        <Label>Goal name</Label>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Buy a laptop"
          placeholderTextColor="#6B6B78"
          className="rounded-md border border-border-strong bg-surface px-md py-md text-text-primary"
        />
      </View>

      <View className="gap-sm">
        <Label>Target amount ({currency})</Label>
        <TextInput
          value={targetInput}
          onChangeText={setTargetInput}
          keyboardType="decimal-pad"
          placeholder="900000"
          placeholderTextColor="#6B6B78"
          className="rounded-md border border-border-strong bg-surface px-md py-md text-[22px] text-text-primary"
        />
      </View>

      <View className="gap-sm">
        <Label>Already saved (optional)</Label>
        <TextInput
          value={currentInput}
          onChangeText={setCurrentInput}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor="#6B6B78"
          className="rounded-md border border-border-strong bg-surface px-md py-md text-text-primary"
        />
      </View>

      {error ? <Caption className="text-danger">{error}</Caption> : null}

      <View className="flex-row gap-sm pt-sm">
        <Button label="Cancel" variant="secondary" className="flex-1" onPress={() => router.back()} />
        <Button label={isSaving ? 'Saving…' : 'Create goal'} className="flex-1" onPress={handleSave} disabled={isSaving} />
      </View>
    </ScrollView>
  );
}
