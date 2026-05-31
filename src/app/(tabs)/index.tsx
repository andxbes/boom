import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PlaybackControls } from '@/components/player/playback-controls';
import { QueueStatusBar } from '@/components/player/queue-status-bar';
import { ScheduleTimeline } from '@/components/player/schedule-timeline';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';

export default function PlayerScreen() {
  const {
    isReady,
    activeProfile,
    phase,
    schedule,
    playOrder,
    isQueueRunning,
    isAutoScheduleEnabled,
    autoSchedulePlaybackAllowed,
    scheduleManualHold,
    waitingSecondsLeft,
    waitingTotalSeconds,
    currentTrack,
    currentOrderIndex,
    pendingNextOrderIndex,
    playbackCurrentTime,
    playbackDuration,
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
        <View style={styles.footer}>
          <QueueStatusBar
            phase={phase}
            isQueueRunning={isQueueRunning}
            isAutoScheduleEnabled={isAutoScheduleEnabled}
            autoSchedulePlaybackAllowed={autoSchedulePlaybackAllowed}
            scheduleManualHold={scheduleManualHold}
            profileSettings={activeProfile.settings}
            waitingSecondsLeft={waitingSecondsLeft}
            waitingTotalSeconds={waitingTotalSeconds}
            currentTrack={currentTrack}
            currentOrderIndex={currentOrderIndex}
            pendingNextOrderIndex={pendingNextOrderIndex}
            playbackCurrentTime={playbackCurrentTime}
            playbackDuration={playbackDuration}
          />
          <PlaybackControls
            isQueueRunning={isQueueRunning}
            hasTracks={hasTracks}
            onToggle={togglePlayback}
            onPrevious={skipToPrevious}
            onNext={skipToNext}
          />
        </View>
      }>
      <View style={styles.main}>
        <View style={styles.header}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {activeProfile.name}
          </ThemedText>
          {hasTracks ? (
            <ThemedText type="small" themeColor="textSecondary">
              {activeProfile.tracks.length} треков в очереди
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Добавьте аудиофайлы на вкладке «Очередь»
            </ThemedText>
          )}
        </View>
        <ScheduleTimeline
          rows={schedule}
          phase={phase}
          playOrder={playOrder}
          tracks={activeProfile.tracks}
          onTrackPress={playTrackAtOrderIndex}
        />
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
  footer: {
    gap: Spacing.one,
  },
});
