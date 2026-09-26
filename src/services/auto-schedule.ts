import type { ActivityInterval, ProfileSettings } from '@/types/profile';
import { formatTimeOfDay } from '@/utils/time';

export function isAutoScheduleEnabled(settings: ProfileSettings): boolean {
  return settings.autoScheduleEnabled && getValidIntervals(settings.activityIntervals).length > 0;
}

export function describeAutoSchedule(settings: ProfileSettings): string | null {
  if (!isAutoScheduleEnabled(settings)) {
    return null;
  }

  const windows = getValidIntervals(settings.activityIntervals)
    .map(
      (interval) =>
        `${formatTimeOfDay(interval.startMinutes)} – ${formatTimeOfDay(interval.endMinutes)}`,
    )
    .join(', ');

  return `Расписание: ${windows}`;
}

export function isWithinTimeWindow(nowMinutes: number, startMinutes: number, stopMinutes: number): boolean {
  if (startMinutes === stopMinutes) {
    return false;
  }
  if (startMinutes < stopMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < stopMinutes;
  }
  return nowMinutes >= startMinutes || nowMinutes < stopMinutes;
}

function getValidIntervals(intervals: ActivityInterval[]): ActivityInterval[] {
  return intervals.filter((interval) => interval.startMinutes !== interval.endMinutes);
}

/** null — расписание выключено; true/false — очередь должна играть или нет. */
export function isSchedulePlaybackAllowed(
  settings: ProfileSettings,
  now = new Date(),
): boolean | null {
  if (!isAutoScheduleEnabled(settings)) {
    return null;
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return getValidIntervals(settings.activityIntervals).some((interval) =>
    isWithinTimeWindow(nowMinutes, interval.startMinutes, interval.endMinutes),
  );
}

const MAX_SCHEDULE_PROBE_MINUTES = 49 * 60;

/** Миллисекунды до следующей смены allowed/not-allowed; null если расписание выключено. */
export function msUntilScheduleChanges(
  settings: ProfileSettings,
  now = new Date(),
): number | null {
  if (!isAutoScheduleEnabled(settings)) {
    return null;
  }

  const currentAllowed = isSchedulePlaybackAllowed(settings, now);
  const probe = new Date(now);
  probe.setSeconds(0, 0);
  probe.setMinutes(probe.getMinutes() + 1);

  for (let minute = 0; minute < MAX_SCHEDULE_PROBE_MINUTES; minute += 1) {
    const nextAllowed = isSchedulePlaybackAllowed(settings, probe);
    if (nextAllowed !== currentAllowed) {
      return Math.max(0, probe.getTime() - now.getTime());
    }
    probe.setMinutes(probe.getMinutes() + 1);
  }

  return null;
}
