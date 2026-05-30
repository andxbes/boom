import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { SettingsPanel } from '@/components/player/settings-panel';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';

export default function SettingsScreen() {
  const { isReady, activeProfile, updateSettings } = useApp();

  if (!isReady || !activeProfile) {
    return (
      <ScreenShell>
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Настройки</ThemedText>
          <ThemedText themeColor="textSecondary" type="small">
            Профиль: {activeProfile.name}
          </ThemedText>
        </View>
        <SettingsPanel settings={activeProfile.settings} onChange={updateSettings} />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: Spacing.four,
    paddingBottom: Spacing.four,
  },
  header: {
    gap: Spacing.one,
  },
});
