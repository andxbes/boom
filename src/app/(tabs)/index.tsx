import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PlaybackControls } from '@/components/player/playback-controls';
import { ScheduleTable } from '@/components/player/schedule-table';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';

export default function PlayerScreen() {
  const {
    isReady,
    activeProfile,
    schedule,
    isQueueRunning,
    togglePlayback,
    skipToNext,
    skipToPrevious,
    playTrackAtOrderIndex,
  } = useApp();

  if (!isReady || !activeProfile) {
    return (
      <ScreenShell>
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      </ScreenShell>
    );
  }

  const hasTracks = activeProfile.tracks.length > 0;

  return (
    <ScreenShell
      footer={
        <PlaybackControls
          isQueueRunning={isQueueRunning}
          hasTracks={hasTracks}
          onToggle={togglePlayback}
          onPrevious={skipToPrevious}
          onNext={skipToNext}
        />
      }>
      <View style={styles.main}>
        <View style={styles.header}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {activeProfile.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {hasTracks
              ? `${activeProfile.tracks.length} треков · расписание воспроизведения`
              : 'Добавьте аудиофайлы на вкладке «Очередь»'}
          </ThemedText>
        </View>
        <ScheduleTable rows={schedule} onTrackPress={playTrackAtOrderIndex} />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: {
    flex: 1,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.one,
  },
});
