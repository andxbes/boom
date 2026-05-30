import type { PlayerPhase } from '@/services/queue';
import type { ProfileSettings, Track } from '@/types/profile';

export type ScheduleRow = {
  id: string;
  kind: 'track' | 'pause';
  timestampMs: number;
  /** Индекс в порядке воспроизведения (0-based). */
  orderIndex: number | null;
  sequenceNumber: number | null;
  label: string;
  isCurrent: boolean;
  isEstimated: boolean;
};

const DEFAULT_TRACK_DURATION = 180;
const MAX_ROWS = 40;
const MAX_TIMELINE_TRACKS = 10;

export function toTimelineTracks(rows: ScheduleRow[]): ScheduleRow[] {
  return rows.filter((row) => row.kind === 'track').slice(0, MAX_TIMELINE_TRACKS);
}

type BuildScheduleInput = {
  tracks: Track[];
  playOrder: number[];
  settings: ProfileSettings;
  phase: PlayerPhase;
  currentOrderIndex: number;
  pendingNextOrderIndex: number | null;
  currentTime: number;
  currentDuration: number;
  waitingSecondsLeft: number;
  waitingTotalSeconds: number;
};

export function buildSchedule(input: BuildScheduleInput): ScheduleRow[] {
  const {
    tracks,
    playOrder,
    settings,
    phase,
    currentOrderIndex,
    pendingNextOrderIndex,
    currentTime,
    currentDuration,
    waitingSecondsLeft,
  } = input;

  if (playOrder.length === 0 || tracks.length === 0) {
    return [];
  }

  const rows: ScheduleRow[] = [];
  const now = Date.now();

  if (phase === 'playing' || phase === 'paused') {
    const track = tracks[playOrder[currentOrderIndex]!];
    if (track) {
      const duration = currentDuration > 0 ? currentDuration : getDuration(track);
      const startedAt = now - currentTime * 1000;
      rows.push(makeTrackRow(track, currentOrderIndex, startedAt, phase === 'playing', false));
      appendUpcoming(
        rows,
        tracks,
        playOrder,
        settings,
        getNextIndex(playOrder, currentOrderIndex, settings.loop),
        startedAt + duration * 1000,
        true,
      );
    }
    return rows;
  }

  if (phase === 'waiting') {
    const nextIndex =
      pendingNextOrderIndex ?? getNextIndex(playOrder, currentOrderIndex, settings.loop);
    appendUpcoming(
      rows,
      tracks,
      playOrder,
      settings,
      nextIndex,
      now + waitingSecondsLeft * 1000,
      false,
    );
    return rows;
  }

  appendUpcoming(
    rows,
    tracks,
    playOrder,
    settings,
    currentOrderIndex,
    now,
    phase === 'idle',
  );
  return rows;
}

function appendUpcoming(
  rows: ScheduleRow[],
  tracks: Track[],
  playOrder: number[],
  settings: ProfileSettings,
  startOrderIndex: number | null,
  startCursorMs: number,
  allEstimated: boolean,
) {
  let orderIndex = startOrderIndex;
  let cursorMs = startCursorMs;
  let cycles = 0;
  const maxCycles = settings.loop ? 2 : 1;

  while (rows.length < MAX_ROWS && orderIndex !== null) {
    const track = tracks[playOrder[orderIndex]!];
    if (!track) {
      break;
    }

    rows.push(makeTrackRow(track, orderIndex, cursorMs, false, allEstimated));
    cursorMs += getDuration(track) * 1000;

    const nextIndex = getNextIndex(playOrder, orderIndex, settings.loop);
    if (nextIndex === null) {
      break;
    }

    if (settings.intervalEnabled && settings.maxIntervalSeconds > 0) {
      const estimate = Math.round(settings.maxIntervalSeconds / 2);
      cursorMs += estimate * 1000;
    }

    if (nextIndex === 0) {
      cycles += 1;
      if (cycles >= maxCycles) {
        break;
      }
    }

    orderIndex = nextIndex;
  }
}

function makeTrackRow(
  track: Track,
  orderIndex: number,
  timestampMs: number,
  isCurrent: boolean,
  isEstimated: boolean,
): ScheduleRow {
  return {
    id: `track-${orderIndex}-${timestampMs}`,
    kind: 'track',
    timestampMs,
    orderIndex,
    sequenceNumber: orderIndex + 1,
    label: track.name,
    isCurrent,
    isEstimated,
  };
}

function getDuration(track: Track): number {
  return track.durationSeconds && track.durationSeconds > 0
    ? track.durationSeconds
    : DEFAULT_TRACK_DURATION;
}

function getNextIndex(playOrder: number[], current: number, loop: boolean): number | null {
  const next = current + 1;
  if (next < playOrder.length) {
    return next;
  }
  return loop ? 0 : null;
}
