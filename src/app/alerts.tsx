import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Caption, EmptyState, IconCircle, Title } from '@/components/ui';
import { useThemeColors } from '@/constants/theme';
import { useAlerts } from '@/features/alerts/useAlerts';
import type { Alert } from '@/features/alerts/alerts';
import { useT } from '@/i18n';

export default function AlertsScreen() {
  const alerts = useAlerts();
  const { t } = useT();

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-sm p-lg pb-3xl">
      {alerts.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title={t('alerts.none')}
          description={t('alerts.noneHint')}
        />
      ) : (
        alerts.map((alert) => <AlertRow key={alert.id} alert={alert} />)
      )}
    </ScrollView>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const colors = useThemeColors();
  const tone = alert.severity === 'danger' ? colors.danger : colors.warning;
  const toneMuted = alert.severity === 'danger' ? colors['danger-muted'] : colors['warning-muted'];

  return (
    <Pressable
      onPress={() => router.navigate(alert.href)}
      accessibilityRole="button"
      accessibilityLabel={`${alert.title}. ${alert.detail}`}
      className="flex-row items-center gap-md rounded-md border border-border bg-surface p-md"
    >
      <IconCircle name={alert.icon} color={tone} backgroundColor={toneMuted} />
      <View className="flex-1 gap-xs">
        <Title numberOfLines={2}>{alert.title}</Title>
        <Caption className="text-text-secondary">{alert.detail}</Caption>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors['text-muted']} />
    </Pressable>
  );
}
