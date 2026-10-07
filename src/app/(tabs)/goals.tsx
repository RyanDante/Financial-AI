import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, ScreenHeader } from '@/components/ui';
import { GoalCard } from '@/components/finance/GoalCard';
import { useFinanceStore } from '@/store/financeStore';
import { useThemeColors } from '@/constants/theme';
import { useT } from '@/i18n';

export default function GoalsScreen() {
  const colors = useThemeColors();
  const goals = useFinanceStore((s) => s.goals);
  const { t } = useT();

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="pb-3xl">
      <ScreenHeader
        title={t('nav.goals')}
        right={
          <Pressable onPress={() => router.push('/goal/new')} accessibilityRole="button" accessibilityLabel={t('goals.add')} className="rounded-full bg-accent p-sm">
            <Ionicons name="add" size={20} color={colors['on-accent']} />
          </Pressable>
        }
      />

      <View className="gap-md px-lg">
        {goals.length === 0 ? (
          <EmptyState icon="flag-outline" title={t('goals.none')} description={t('goals.noneHint')} />
        ) : (
          goals.map((goal) => (
            <Pressable
              key={goal.id}
              onPress={() => router.push({ pathname: '/goal/[id]', params: { id: goal.id } })}
              accessibilityRole="button"
              accessibilityLabel={t('goals.openA11y', { goal: goal.name })}
            >
              <GoalCard goal={goal} />
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}
