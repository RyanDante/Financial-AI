import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, ScreenHeader } from '@/components/ui';
import { GoalCard } from '@/components/finance/GoalCard';
import { useFinanceStore } from '@/store/financeStore';

export default function GoalsScreen() {
  const goals = useFinanceStore((s) => s.goals);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="pb-3xl">
      <ScreenHeader
        title="Goals"
        right={
          <Pressable onPress={() => router.push('/goal/new')} className="rounded-full bg-accent p-sm">
            <Ionicons name="add" size={20} color="#F5F5F7" />
          </Pressable>
        }
      />

      <View className="gap-md px-lg">
        {goals.length === 0 ? (
          <EmptyState icon="flag-outline" title="No goals yet" description="Tap + to set your first savings goal." />
        ) : (
          goals.map((goal) => <GoalCard key={goal.id} goal={goal} />)
        )}
      </View>
    </ScrollView>
  );
}
