import type { ProfileSettings } from '@/types/profile';
import { formatTimeOfDay } from '@/utils/time';

export function isAutoScheduleEnabled(settings: ProfileSettings): boolean {
  return settings.autoStartEnabled || settings.autoStopEnabled;
}

export function describeAutoSchedule(settings: ProfileSettings): string | null {
  if (!isAutoScheduleEnabled(settings)) {
    return null;
  }

  const start = formatTimeOfDay(settings.autoStartMinutes);
  const stop = formatTimeOfDay(settings.autoStopMinutes);

  if (settings.autoStartEnabled && settings.autoStopEnabled) {
    return `Расписание: ${start} – ${stop}`;
  }
  if (settings.autoStartEnabled) {
    return `Автозапуск с ${start}`;
  }
  return `Автоостановка в ${stop}`;
}

export function isWithinTimeWindow(nowMinutes: number, startMinutes: number, stopMinutes: number): boolean {
  if (startMinutes === stopMinutes) {
    return true;
  }
  if (startMinutes < stopMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < stopMinutes;
  }
  return nowMinutes >= startMinutes || nowMinutes < stopMinutes;
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

  if (settings.autoStartEnabled && settings.autoStopEnabled) {
    return isWithinTimeWindow(nowMinutes, settings.autoStartMinutes, settings.autoStopMinutes);
  }

  if (settings.autoStartEnabled) {
    return nowMinutes >= settings.autoStartMinutes;
  }

  return nowMinutes < settings.autoStopMinutes;
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
