import type { ProfileSettings, Track } from '@/types/profile';

export type PlayerPhase = 'idle' | 'playing' | 'waiting' | 'paused';

export function buildPlayOrder(trackCount: number, shuffle: boolean): number[] {
  const order = Array.from({ length: trackCount }, (_, index) => index);
  if (!shuffle || trackCount <= 1) {
    return order;
  }
  return shuffleIndices(order);
}

export function getNextQueueIndex(
  playOrder: number[],
  currentOrderIndex: number,
  loop: boolean,
): number | null {
  if (playOrder.length === 0) {
    return null;
  }
  const next = currentOrderIndex + 1;
  if (next < playOrder.length) {
    return next;
  }
  return loop ? 0 : null;
}

export function getRandomIntervalSeconds(settings: ProfileSettings): number {
  if (!settings.intervalEnabled || settings.maxIntervalSeconds <= 0) {
    return 0;
  }
  return Math.floor(Math.random() * (settings.maxIntervalSeconds + 1));
}

export function getTrackAt(playOrder: number[], orderIndex: number, tracks: Track[]): Track | null {
  const trackIndex = playOrder[orderIndex];
  if (trackIndex === undefined) {
    return null;
  }
  return tracks[trackIndex] ?? null;
}

function shuffleIndices(values: number[]): number[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
