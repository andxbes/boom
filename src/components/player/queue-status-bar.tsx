import { View, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { describeAutoSchedule } from '@/services/auto-schedule';
import type { PlayerPhase } from '@/services/queue';
import type { ProfileSettings, Track } from '@/types/profile';
import { formatCountdown } from '@/utils/time';

type QueueStatusBarProps = {
  phase: PlayerPhase;
  isQueueRunning: boolean;
  isAutoScheduleEnabled: boolean;
  autoSchedulePlaybackAllowed: boolean | null;
  scheduleManualHold: boolean;
  profileSettings: ProfileSettings;
  waitingSecondsLeft: number;
  waitingTotalSeconds: number;
  currentTrack: Track | null;
  currentOrderIndex: number;
  pendingNextOrderIndex: number | null;
  playbackCurrentTime: number;
  playbackDuration: number;
};

export function QueueStatusBar({
  phase,
  isQueueRunning,
  isAutoScheduleEnabled,
  autoSchedulePlaybackAllowed,
  scheduleManualHold,
  profileSettings,
  waitingSecondsLeft,
  waitingTotalSeconds,
  currentTrack,
  currentOrderIndex,
  pendingNextOrderIndex,
  playbackCurrentTime,
  playbackDuration,
}: QueueStatusBarProps) {
  const nextTrackNumber = (pendingNextOrderIndex ?? currentOrderIndex) + 1;
  const showCountdown = phase === 'waiting' || (phase === 'paused' && pendingNextOrderIndex !== null);
  const countdownProgress =
    waitingTotalSeconds > 0 ? 1 - waitingSecondsLeft / waitingTotalSeconds : 0;

  const trackRemaining =
    playbackDuration > 0 ? Math.max(0, Math.ceil(playbackDuration - playbackCurrentTime)) : null;

  const scheduleDescription = isAutoScheduleEnabled ? describeAutoSchedule(profileSettings) : null;

  let statusLabel = 'Очередь остановлена';
  let detailLabel = 'Нажмите ▶, чтобы запустить отсчёт';

  if (phase === 'waiting') {
    statusLabel = `До трека № ${nextTrackNumber}`;
    detailLabel = 'Случайная пауза между треками';
  } else if (phase === 'paused' && pendingNextOrderIndex !== null) {
    statusLabel = `Пауза · до трека № ${nextTrackNumber}`;
    detailLabel = 'Отсчёт приостановлен';
  } else if (phase === 'playing' || (phase === 'paused' && currentTrack)) {
    statusLabel = `Играет · № ${currentOrderIndex + 1}`;
    detailLabel = currentTrack?.name ?? '';
  } else if (isQueueRunning) {
    statusLabel = 'Очередь активна';
    detailLabel = '';
  }

  if (isAutoScheduleEnabled && scheduleDescription) {
    if (autoSchedulePlaybackAllowed === false) {
      detailLabel = `${scheduleDescription} · сейчас вне окна`;
    } else if (autoSchedulePlaybackAllowed === true && phase === 'idle' && !scheduleManualHold) {
      detailLabel = `${scheduleDescription} · автозапуск…`;
    } else if (autoSchedulePlaybackAllowed === true && scheduleManualHold) {
      detailLabel = `${scheduleDescription} · пауза до конца окна`;
    } else if (autoSchedulePlaybackAllowed === true) {
      detailLabel = scheduleDescription;
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.container}>
      <View style={styles.texts}>
        <ThemedText type="smallBold">{statusLabel}</ThemedText>
        {detailLabel ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {detailLabel}
          </ThemedText>
        ) : null}
      </View>

      {showCountdown ? (
        <View style={styles.countdownBlock}>
          <ThemedText style={styles.countdown}>{formatCountdown(waitingSecondsLeft)}</ThemedText>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(countdownProgress * 100)}%` }]} />
          </View>
        </View>
      ) : null}

      {phase === 'playing' && trackRemaining !== null && !showCountdown ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.remaining}>
          осталось {formatCountdown(trackRemaining)}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  texts: {
    gap: Spacing.half,
  },
  countdownBlock: {
    gap: Spacing.one,
    alignItems: 'center',
  },
  countdown: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    alignSelf: 'stretch',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.2)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3c87f7',
    borderRadius: 2,
  },
  remaining: {
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
