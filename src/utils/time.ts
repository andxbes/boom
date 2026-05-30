export const MAX_INTERVAL_SECONDS = 3600;

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
