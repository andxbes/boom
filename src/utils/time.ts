import { MINUTES_PER_DAY, normalizeMinutesOfDay } from '@/types/profile';

export const MAX_INTERVAL_SECONDS = 3600;

export function formatTimeOfDay(minutes: number): string {
  const normalized = normalizeMinutesOfDay(minutes);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function minutesToTimeOfDay(hours: number, mins: number): number {
  return normalizeMinutesOfDay(hours * 60 + mins);
}

export function formatClockTime(timestampMs: number): string {
  const date = new Date(timestampMs);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) {
    return 'Выкл';
  }
  if (seconds < 60) {
    return `${seconds} сек`;
  }
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest > 0 ? `${minutes} мин ${rest} сек` : `${minutes} мин`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
}

/** Формат отсчёта: 0:45, 1:05, 12:30 */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${String(mins).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  }
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
